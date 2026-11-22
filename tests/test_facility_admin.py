"""FR-10/TC-27 ADMIN facility status (#56): isolated in-memory stores, plus real PostgreSQL + MongoDB.

The real-stack test runs with SMARTLOO_TEST_POSTGIS=1 and SMARTLOO_TEST_MONGO=1 after migrate.sh
and the synthetic fixtures; it restores fixture toilet C afterwards.
"""
import os
import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from src.app import create_app

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
A = "00000000-0000-4000-8000-000000000001"
U, ADMIN = "00000000-0000-4000-9000-000000000001", "00000000-0000-4000-9000-000000000003"


def token(user, role="USER"):
    now = int(time.time())
    return {"Authorization": "Bearer " + jwt.encode(
        {"sub": user, "role": role, "iat": now, "exp": now + 3600}, KEY, algorithm="HS256")}


@pytest.fixture
def env():
    state = {"toilets": {A: {"id": A, "status": "ACTIVE", "average_cleanliness": None, "review_count": 0}},
             "users": {U: {"id": U, "email": "u@example.com", "display_name": "Ali", "role": "USER", "password_hash": "x"},
                       ADMIN: {"id": ADMIN, "email": "a@example.com", "display_name": "Admin", "role": "ADMIN",
                               "password_hash": "x"}},
             "reviews": {}, "login_attempts": []}
    app = create_app(state, jwt_secret=KEY)
    with TestClient(app) as client:
        yield client, app.state.repository


def close(client, toilet=A, headers=None, status="CLOSED"):
    return client.patch(f"/api/v1/admin/toilets/{toilet}", headers=headers or token(ADMIN, "ADMIN"),
                        json={"status": status})


def test_only_an_admin_can_change_status(env):
    client, store = env
    assert client.patch(f"/api/v1/admin/toilets/{A}", json={"status": "CLOSED"}).status_code == 401
    assert close(client, headers=token(U)).status_code == 403
    assert close(client, status="DELETED").status_code == 422
    assert close(client, toilet="00000000-0000-4000-8000-999999999999").status_code == 404
    assert store["toilets"][A]["status"] == "ACTIVE"


def test_closing_keeps_reviews_and_moves_the_revision(env):
    client, store = env
    assert client.post(f"/api/v1/toilets/{A}/reviews", headers=token(U), json={"cleanliness_score": 4}).status_code == 201
    version = store["toilets"][A]["review_version"]
    response = close(client, status="closed")
    assert response.status_code == 200
    assert response.json() == {"id": A, "status": "CLOSED", "review_version": version + 1}
    assert len(store["reviews"]) == 1 and store["toilets"][A]["review_count"] == 1
    assert client.get(f"/api/v1/toilets/{A}/reviews").json()["count"] == 1
    assert client.post(f"/api/v1/toilets/{A}/reviews", headers=token(ADMIN, "ADMIN"),
                       json={"cleanliness_score": 2}).status_code == 404


def test_reopening_allows_reviews_again(env):
    client, _ = env
    close(client)
    assert close(client, status="ACTIVE").json()["status"] == "ACTIVE"
    assert client.post(f"/api/v1/toilets/{A}/reviews", headers=token(U), json={"cleanliness_score": 3}).status_code == 201


def test_status_waits_for_an_unfinished_review_change(env):
    client, store = env
    store["review_operations"][A] = {"operation_id": str(uuid.uuid4()), "review_id": "r1",
                                     "before_document": None, "state": "repair_required"}
    assert close(client).status_code == 503
    assert store["toilets"][A]["status"] == "ACTIVE"


@pytest.mark.skipif(os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1",
                    reason="Requires local PostgreSQL with fixtures and MongoDB")
def test_close_on_real_postgres():
    from src.db import connect

    c = "00000000-0000-4000-8000-000000000003"  # synthetic fixture already CLOSED in seeds; reopen then close
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    app = create_app(jwt_secret=KEY)
    try:
        with TestClient(app) as client:
            client.post("/api/v1/auth/register", json={"email": email, "password": "Guvenli123", "display_name": "Admin"})
            with connect() as conn:
                conn.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (email,))
            auth = {"Authorization": "Bearer " + client.post(
                "/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).json()["access_token"]}
            opened = close(client, toilet=c, headers=auth, status="ACTIVE")
            assert opened.status_code == 200, opened.text
            assert c in [r["id"] for r in client.get("/api/v1/toilets/nearby",
                                                     params={"lat": 41, "lon": 29, "open_now": True}).json()["results"]]
            closed = close(client, toilet=c, headers=auth)
            assert closed.json()["status"] == "CLOSED"
            assert closed.json()["review_version"] == opened.json()["review_version"] + 1
            assert c not in [r["id"] for r in client.get("/api/v1/toilets/nearby",
                                                         params={"lat": 41, "lon": 29, "open_now": True}).json()["results"]]
    finally:
        with connect() as conn:
            conn.execute("UPDATE toilets SET status = 'CLOSED' WHERE id = %s", (c,))
            conn.execute("DELETE FROM users WHERE email = %s", (email,))
