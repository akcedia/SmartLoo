"""FR-10 account deletion through the real stack: FastAPI + PostgreSQL + MongoDB (TC-34).

Run after migrate.sh and the synthetic fixtures with SMARTLOO_TEST_POSTGIS=1 and
SMARTLOO_TEST_MONGO=1. Reviews go to a throwaway MongoDB database; fixture toilets A and B
get their aggregates reset afterwards.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

pymongo = pytest.importorskip("pymongo")

from src.app import create_app
from src.db import connect

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1",
    reason="Requires local PostgreSQL with fixtures and MongoDB",
)

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
A, B = "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"


def toilet_rows():
    with connect() as conn:
        rows = conn.execute("""SELECT id::text, average_cleanliness, review_count, review_version
                               FROM toilets WHERE id = ANY(%s)""", ([A, B],)).fetchall()
    return {r["id"]: r for r in rows}


@pytest.fixture
def setup(monkeypatch):
    db_name = f"smartloo_test_{uuid.uuid4().hex[:8]}"
    monkeypatch.setenv("SMARTLOO_MONGO_DB", db_name)
    email = f"silinecek-{uuid.uuid4().hex[:8]}@example.com"
    mongo = pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://localhost:27017"))
    yield create_app(jwt_secret=KEY), email, mongo[db_name]["reviews"]
    mongo.drop_database(db_name)
    with connect() as conn:
        conn.execute("UPDATE toilets SET average_cleanliness = NULL, review_count = 0 WHERE id = ANY(%s)", ([A, B],))
        conn.execute("DELETE FROM users WHERE email = %s", (email,))


def test_account_deletion_anonymizes_reviews_and_rejects_the_token(setup):
    app, email, reviews = setup
    with TestClient(app) as client:
        client.post("/api/v1/auth/register", json={"email": email, "password": "Guvenli123",
                                                   "display_name": "Deneme Kişi"})
        auth = {"Authorization": "Bearer " + client.post(
            "/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).json()["access_token"]}
        for toilet, score in [(A, 4), (B, 2)]:
            assert client.post(f"/api/v1/toilets/{toilet}/reviews", headers=auth, json={
                "cleanliness_score": score, "comment": f"Deneme Kişi burada, {email}"}).status_code == 201
        before = toilet_rows()

        assert client.delete("/api/v1/users/me", headers=auth).status_code == 204

        with connect() as conn:
            assert conn.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone() is None
        docs = list(reviews.find({}, {"_id": 0}))
        assert len(docs) == 2
        for doc in docs:
            assert doc["user_id"] is None and doc["is_anonymized"] is True
            assert "Deneme" not in doc["comment"] and email not in doc["comment"]
        after = toilet_rows()
        for toilet in (A, B):
            assert (after[toilet]["average_cleanliness"], after[toilet]["review_count"]) == \
                   (before[toilet]["average_cleanliness"], before[toilet]["review_count"])
            assert after[toilet]["review_version"] == before[toilet]["review_version"] + 1
        assert {r["author"] for r in client.get(f"/api/v1/toilets/{A}/reviews").json()["results"]} == {"Anonymous"}

        assert client.delete("/api/v1/users/me", headers=auth).status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).status_code == 401
        with connect() as conn:
            assert conn.execute("SELECT count(*) AS n FROM review_operations").fetchone()["n"] == 0
