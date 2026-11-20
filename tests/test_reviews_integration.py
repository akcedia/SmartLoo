"""FR-03 reviews through the real stack: FastAPI + PostgreSQL (accounts, aggregates) + MongoDB (reviews).

Run after migrate.sh and the synthetic fixtures with SMARTLOO_TEST_POSTGIS=1 and
SMARTLOO_TEST_MONGO=1. Reviews go to a throwaway MongoDB database; fixture toilet A
gets its aggregates reset afterwards, and the test accounts are deleted.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Event

import pytest
from fastapi.testclient import TestClient

pymongo = pytest.importorskip("pymongo")

from src.app import create_app
from src.auth import Principal
from src.db import connect
from src.reviews import MongoReviews, PostgresToilets, ReviewIn, ReviewPatch, ReviewService
from src.auth import PostgresAccounts

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
        conn.execute("DELETE FROM review_operations WHERE toilet_id = %s", (A,))
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


def test_real_dirty_window_blocks_summary_and_serializes_edit_delete(app, monkeypatch):
    with TestClient(app) as client:
        user, auth = sign_up(client, app, "Owner")
        created = client.post(f"/api/v1/toilets/{A}/reviews", headers=auth,
                              json={"cleanliness_score": 4, "comment": "Original"})
        assert created.status_code == 201
        review_id = created.json()["id"]
        service = app.state.reviews
        changed, release = Event(), Event()
        recompute = service.toilets.recompute

        def paused_recompute(*args, **kwargs):
            changed.set()
            assert release.wait(5), "Test did not release writer"
            return recompute(*args, **kwargs)

        monkeypatch.setattr(service.toilets, "recompute", paused_recompute)
        principal = Principal(sub=user["id"], role="USER")
        with ThreadPoolExecutor(max_workers=2) as pool:
            editing = pool.submit(service.update, principal, review_id,
                                  ReviewPatch(cleanliness_score=1, comment="Edited"))
            try:
                assert changed.wait(5)
                # Separate service/connections reproduce the multi-worker read.
                reader = ReviewService(MongoReviews(), PostgresToilets(), PostgresAccounts())
                snapshot = reader.read_summary_snapshot(A)
                assert snapshot["state"] == "busy" and snapshot["reviews"] == []
                assert snapshot["review_count"] == 1 and snapshot["average_cleanliness"] == 4
                deleting = pool.submit(service.delete, principal, review_id)
            finally:
                release.set()
            assert editing.result(timeout=10)["cleanliness_score"] == 1
            deleting.result(timeout=10)
        snapshot = reader.read_summary_snapshot(A)
        assert snapshot["state"] == "ready" and snapshot["review_count"] == 0


def test_real_failed_sql_and_undo_persist_repair_and_recover_once(app, monkeypatch):
    with TestClient(app) as client:
        _, auth = sign_up(client, app, "Repair")
        service = app.state.reviews
        start_version = toilet_row()["review_version"]

        def broken(*args, **kwargs):
            raise RuntimeError("Synthetic failure at real store boundary")

        with monkeypatch.context() as patch:
            patch.setattr(service.toilets, "recompute", broken)
            patch.setattr(service.reviews, "delete", broken)
            response = client.post(f"/api/v1/toilets/{A}/reviews", headers=auth,
                                   json={"cleanliness_score": 1, "comment": "Uncommitted"})
            assert response.status_code == 503
        reader = ReviewService(MongoReviews(), PostgresToilets(), PostgresAccounts())
        snapshot = reader.read_summary_snapshot(A)
        assert snapshot["state"] == "repair_required" and snapshot["reviews"] == []
        assert snapshot["review_count"] == 0 and snapshot["review_version"] == start_version
        version = reader.reconcile(A)
        assert version == start_version + 1 and reader.reconcile(A) == version
        assert reader.read_summary_snapshot(A)["state"] == "ready"
        assert reader.reviews.by_toilet(A) == []


def test_pending_marker_survives_server_session_loss(app):
    service = app.state.reviews
    review_id = str(uuid.uuid4())
    with service.coordination.guard(A) as writer:
        writer.begin(review_id, None)
        service.reviews.insert({
            "id": review_id, "toilet_id": A, "user_id": None,
            "cleanliness_score": 1, "comment": "Interrupted", "tags": [],
            "created_at": datetime.now(timezone.utc),
        })
        pid = writer.connection.info.backend_pid
        with connect() as other:
            assert other.execute("SELECT pg_terminate_backend(%s) AS stopped", (pid,)).fetchone()["stopped"]

    restarted = ReviewService(MongoReviews(), PostgresToilets(), PostgresAccounts())
    snapshot = restarted.read_summary_snapshot(A)
    assert snapshot["state"] == "writing" and snapshot["reviews"] == []
    version = restarted.reconcile(A)
    assert restarted.reconcile(A) == version
    assert restarted.reviews.get(review_id) is None
    assert restarted.read_summary_snapshot(A)["state"] == "ready"


@pytest.mark.parametrize("operation", ["edit", "delete"])
def test_failed_sql_transaction_rolls_back_aggregate_and_verifies_compensation(app, monkeypatch, operation):
    with TestClient(app) as client:
        _, auth = sign_up(client, app, "Atomic")
        created = client.post(f"/api/v1/toilets/{A}/reviews", headers=auth,
                              json={"cleanliness_score": 4, "comment": "Original"})
        assert created.status_code == 201
        review_id = created.json()["id"]
        service = app.state.reviews
        before = toilet_row()
        recompute = service.toilets.recompute

        def update_then_fail(*args, **kwargs):
            recompute(*args, **kwargs)
            raise RuntimeError("Synthetic failure after SQL UPDATE, before commit")

        with monkeypatch.context() as patch:
            patch.setattr(service.toilets, "recompute", update_then_fail)
            if operation == "edit":
                response = client.patch(f"/api/v1/reviews/{review_id}", headers=auth,
                                        json={"cleanliness_score": 1})
            else:
                response = client.delete(f"/api/v1/reviews/{review_id}", headers=auth)
            assert response.status_code == 503

        assert toilet_row() == before
        restored = service.reviews.get(review_id)
        assert restored["cleanliness_score"] == 4 and restored["comment"] == "Original"
        snapshot = service.read_summary_snapshot(A)
        assert snapshot["state"] == "ready" and snapshot["operation_id"] is None
        assert snapshot["review_version"] == before["review_version"]
