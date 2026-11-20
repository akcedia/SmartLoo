"""FR-03 reviews through the real stack: FastAPI + PostgreSQL (accounts, aggregates) + MongoDB (reviews).

Run after migrate.sh and the synthetic fixtures with SMARTLOO_TEST_POSTGIS=1 and
SMARTLOO_TEST_MONGO=1. Reviews go to a throwaway MongoDB database; fixture toilet A
gets its aggregates reset afterwards, and the test accounts are deleted.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

pymongo = pytest.importorskip("pymongo")

from src.app import create_app
from src.auth import Principal
from src.db import connect
from src.reviews import ReviewIn

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1",
    reason="Requires local PostgreSQL with fixtures and MongoDB",
)

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
A = "00000000-0000-4000-8000-000000000001"  # synthetic fixture toilet


def toilet_row():
    with connect() as conn:
        return conn.execute("SELECT average_cleanliness, review_count, review_version FROM toilets WHERE id = %s",
                            (A,)).fetchone()


@pytest.fixture
def app(monkeypatch):
    db_name = f"smartloo_test_{uuid.uuid4().hex[:8]}"
    monkeypatch.setenv("SMARTLOO_MONGO_DB", db_name)
    emails = []
    application = create_app(jwt_secret=KEY)
    application.state.test_emails = emails
    yield application
    pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://localhost:27017")).drop_database(db_name)
    with connect() as conn:
        conn.execute("UPDATE toilets SET average_cleanliness = NULL, review_count = 0 WHERE id = %s", (A,))
        conn.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))


def sign_up(client, app, name):
    email = f"{name}-{uuid.uuid4().hex[:8]}@example.com"
    app.state.test_emails.append(email)
    user = client.post("/api/v1/auth/register",
                       json={"email": email, "password": "Guvenli123", "display_name": name}).json()
    access = client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).json()
    return user, {"Authorization": f"Bearer {access['access_token']}"}


def test_review_lifecycle_keeps_postgres_aggregates_and_revision(app):
    with TestClient(app) as client:
        start_version = toilet_row()["review_version"]
        ali, ali_auth = sign_up(client, app, "Ali")
        veli, veli_auth = sign_up(client, app, "Veli")
        url = f"/api/v1/toilets/{A}/reviews"

        created = client.post(url, headers=ali_auth, json={"cleanliness_score": 4, "comment": "Temiz",
                                                           "tags": ["clean"]})
        assert created.status_code == 201, created.text
        assert client.post(url, headers=veli_auth, json={"cleanliness_score": 2}).status_code == 201
        assert client.post(url, headers=ali_auth, json={"cleanliness_score": 1}).status_code == 409
        row = toilet_row()
        assert (float(row["average_cleanliness"]), row["review_count"]) == (3.0, 2)
        assert row["review_version"] == start_version + 2

        review_id = created.json()["id"]
        assert client.patch(f"/api/v1/reviews/{review_id}", headers=veli_auth,
                            json={"cleanliness_score": 1}).status_code == 403
        assert client.patch(f"/api/v1/reviews/{review_id}", headers=ali_auth,
                            json={"cleanliness_score": 5}).status_code == 200
        assert float(toilet_row()["average_cleanliness"]) == 3.5

        listing = client.get(url).json()
        assert listing["count"] == 2 and {r["author"] for r in listing["results"]} == {"Ali", "Veli"}
        owned = client.get(url, headers=ali_auth).json()["results"]
        own_review = next(review for review in owned if review["id"] == review_id)
        assert own_review["is_own"] and own_review["can_edit"] and own_review["can_delete"]
        assert all("user_id" not in review for review in owned)
        other_review = next(review for review in owned if review["id"] != review_id)
        assert not other_review["is_own"] and not other_review["can_edit"] and not other_review["can_delete"]

        assert client.delete(f"/api/v1/reviews/{review_id}", headers=ali_auth).status_code == 204
        row = toilet_row()
        assert (float(row["average_cleanliness"]), row["review_count"]) == (2.0, 1)
        assert row["review_version"] == start_version + 4
        summary_input = app.state.reviews.eligible_for_summary(A)
        assert summary_input["review_version"] == row["review_version"] and summary_input["reviews"] == []


def test_concurrent_reviews_give_correct_aggregates(app):
    with TestClient(app) as client:
        users = [sign_up(client, app, f"User{n}")[0] for n in range(8)]
        scores = [1, 2, 3, 4, 5, 5, 4, 3]

        def create(pair):
            user, score = pair
            app.state.reviews.create(Principal(sub=user["id"], role="USER"), A, ReviewIn(cleanliness_score=score))

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(create, zip(users, scores)))

        row = toilet_row()
        assert row["review_count"] == 8
        assert float(row["average_cleanliness"]) == round(sum(scores) / 8, 2)
