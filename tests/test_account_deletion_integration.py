"""FR-10 account deletion through the real stack: FastAPI + PostgreSQL + MongoDB (TC-34).

Run after migrate.sh and the synthetic fixtures with SMARTLOO_TEST_POSTGIS=1 and
SMARTLOO_TEST_MONGO=1. Reviews go to a throwaway MongoDB database; fixture toilets A and B
get their aggregates reset afterwards.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi.testclient import TestClient

pymongo = pytest.importorskip("pymongo")

from src.app import create_app
from src.db import connect
from src.auth import Principal
from src.reviews import ReviewIn
from src.review_coordination import PostgresReviewCoordination
from fastapi import HTTPException

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
    mongo.close()
    with connect() as conn:
        conn.execute("DELETE FROM review_operations WHERE toilet_id=ANY(%s::uuid[])", ([A, B],))
        conn.execute("UPDATE toilets SET average_cleanliness = NULL, review_count = 0 WHERE id = ANY(%s)", ([A, B],))
        conn.execute("DELETE FROM users WHERE email = %s", (email,))
        conn.execute("DELETE FROM login_failures WHERE email = %s", (email,))


def register(client, email):
    result = client.post("/api/v1/auth/register", json={"email":email,"password":"Guvenli123","display_name":"Deneme Kişi"})
    assert result.status_code == 201, result.text
    auth = {"Authorization":"Bearer " + client.post("/api/v1/auth/login",json={"email":email,"password":"Guvenli123"}).json()["access_token"]}
    return result.json()["id"], auth


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


def test_live_prevalidated_write_cannot_outlive_account_removal(setup, monkeypatch):
    app,email,docs = setup
    reached,proceed,attempted = Event(),Event(),Event()
    original = app.state.accounts.delete
    def pause(*args):
        reached.set()
        assert proceed.wait(10)
        return original(*args)
    monkeypatch.setattr(app.state.accounts,"delete",pause)
    with TestClient(app) as client:
        user,auth = register(client,email)
        assert client.post(f"/api/v1/toilets/{A}/reviews",headers=auth,json={"cleanliness_score":4}).status_code == 201
        def stale_write():
            attempted.set()
            return app.state.reviews.create(Principal(user,"USER"),B,ReviewIn(cleanliness_score=1,comment=email))
        with ThreadPoolExecutor(max_workers=2) as pool:
            deletion = pool.submit(client.delete,"/api/v1/users/me",headers=auth)
            try:
                assert reached.wait(10)
                write = pool.submit(stale_write)
                assert attempted.wait(10)
            finally:
                proceed.set()
            assert deletion.result(timeout=10).status_code == 204
            with pytest.raises(HTTPException) as rejected:
                write.result(timeout=10)
            assert rejected.value.status_code == 401
        assert docs.count_documents({"user_id":user}) == 0
        assert docs.count_documents({}) == 1


def test_live_pending_create_blocks_deletion_across_instances(setup):
    app,email,_ = setup
    with TestClient(app) as client:
        user,auth = register(client,email)
        with PostgresReviewCoordination().guard(A) as session:
            session.begin(str(uuid.uuid4()),None,author_id=user)
        # Simulates restart after a marker committed before Mongo insertion.
        with TestClient(create_app(jwt_secret=KEY)) as restarted:
            assert restarted.delete("/api/v1/users/me",headers=auth).status_code == 503
        assert app.state.accounts.get(user) is not None


def test_live_partial_anonymization_needs_repair_before_user_delete(setup, monkeypatch):
    app,email,docs = setup
    with TestClient(app) as client:
        user,auth = register(client,email)
        assert client.post(f"/api/v1/toilets/{A}/reviews",headers=auth,json={"cleanliness_score":4,"comment":email}).status_code == 201
        with monkeypatch.context() as failure:
            failure.setattr(app.state.reviews.toilets,"recompute",lambda *a,**kw: (_ for _ in ()).throw(RuntimeError("SQL fail")))
            failure.setattr(app.state.reviews.reviews,"restore",lambda *a: (_ for _ in ()).throw(RuntimeError("undo fail")))
            assert client.delete("/api/v1/users/me",headers=auth).status_code == 503
        assert docs.count_documents({"user_id":user}) == 0
        with TestClient(create_app(jwt_secret=KEY)) as restarted:
            assert restarted.delete("/api/v1/users/me",headers=auth).status_code == 503
        assert app.state.accounts.get(user) is not None
        app.state.reviews.reconcile(A)
        assert client.delete("/api/v1/users/me",headers=auth).status_code == 204


def test_live_sql_delete_failure_preserves_account_and_history_for_retry(setup):
    app,email,_ = setup
    with TestClient(app) as client:
        user,auth = register(client,email)
        assert client.post(f"/api/v1/toilets/{A}/reviews",headers=auth,json={"cleanliness_score":4,"comment":email}).status_code == 201
        with connect() as conn:
            conn.execute("INSERT INTO login_failures(email) VALUES (%s)",(email,))
            conn.execute("""CREATE FUNCTION fail_user_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
                RAISE EXCEPTION 'synthetic deletion failure'; END $$;
                CREATE TRIGGER test_fail_user_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION fail_user_delete();""")
        try:
            assert client.delete("/api/v1/users/me",headers=auth).status_code == 503
            assert app.state.accounts.get(user) is not None
            with connect() as conn:
                assert conn.execute("SELECT count(*) AS n FROM login_failures WHERE email=%s",(email,)).fetchone()["n"] == 1
            version = toilet_rows()[A]["review_version"]
        finally:
            with connect() as conn:
                conn.execute("DROP TRIGGER test_fail_user_delete ON users; DROP FUNCTION fail_user_delete();")
        assert client.delete("/api/v1/users/me",headers=auth).status_code == 204
        assert toilet_rows()[A]["review_version"] == version


def test_live_lost_sql_session_marker_protects_author_before_mongo_insert(setup, monkeypatch):
    app,email,docs = setup
    with TestClient(app) as client:
        user,auth = register(client,email)
        insert = app.state.reviews.reviews.insert
        def kill_before_insert(document):
            connection = app.state.accounts.active_connection.get()
            assert connection is app.state.reviews.coordination.current.get().connection
            with connect() as killer:
                killer.execute("SELECT pg_terminate_backend(%s)",(connection.info.backend_pid,))
            # Account/facility locks have been lost, but author_id was committed
            # before Mongo has any author document to find.
            with TestClient(create_app(jwt_secret=KEY)) as other_process:
                assert other_process.delete("/api/v1/users/me",headers=auth).status_code == 503
            insert(document)
        monkeypatch.setattr(app.state.reviews.reviews,"insert",kill_before_insert)
        failed = client.post(f"/api/v1/toilets/{A}/reviews",headers=auth,json={"cleanliness_score":4,"comment":email})
        assert failed.status_code == 503
        assert app.state.accounts.get(user) is not None
        assert app.state.reviews.coordination.pending_for_author(user)
        app.state.reviews.reconcile(A)
        assert docs.count_documents({"user_id":user}) == 0
        assert client.delete("/api/v1/users/me",headers=auth).status_code == 204
