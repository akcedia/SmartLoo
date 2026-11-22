"""FR-05 suggestions and moderation (#56): isolated in-memory stores, plus real PostgreSQL + MongoDB.

Real-stack tests run with SMARTLOO_TEST_POSTGIS=1 and SMARTLOO_TEST_MONGO=1 after migrate.sh;
they remove the suggestions, published toilets and accounts they create.
"""
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import jwt
import pytest
from fastapi.testclient import TestClient

from src.app import create_app

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
U, ADMIN = "00000000-0000-4000-9000-000000000001", "00000000-0000-4000-9000-000000000003"
GOOD = {"name": "Moda Sahili WC", "district": "Kadıköy", "latitude": 40.981, "longitude": 29.026}


def token(user, role="USER"):
    now = int(time.time())
    return {"Authorization": "Bearer " + jwt.encode(
        {"sub": user, "role": role, "iat": now, "exp": now + 3600}, KEY, algorithm="HS256")}


@pytest.fixture
def env():
    state = {"toilets": {}, "reviews": {}, "login_attempts": [], "suggestions": {},
             "users": {U: {"id": U, "email": "u@example.com", "display_name": "Ali", "role": "USER", "password_hash": "x"},
                       ADMIN: {"id": ADMIN, "email": "a@example.com", "display_name": "Admin", "role": "ADMIN",
                               "password_hash": "x"}}}
    app = create_app(state, jwt_secret=KEY)
    with TestClient(app) as client:
        yield client, app.state.repository


def suggest(client, headers=None, **body):
    return client.post("/api/v1/toilets/suggest", headers=headers or token(U), json={**GOOD, **body})


def decide(client, suggestion_id, status, headers=None):
    return client.patch(f"/api/v1/admin/suggestions/{suggestion_id}",
                        headers=headers or token(ADMIN, "ADMIN"), json={"status": status})


@pytest.mark.parametrize("body", [{"latitude": 95}, {"longitude": 200}, {"name": "  "}, {"district": ""}])
def test_invalid_suggestion_is_422_and_not_saved(env, body):
    client, store = env
    assert suggest(client, **body).status_code == 422
    assert store["suggestions"] == {}


def test_submission_is_pending_and_not_public(env):
    client, store = env
    assert client.post("/api/v1/toilets/suggest", json=GOOD).status_code == 401
    response = suggest(client, has_disabled_access=True)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "pending" and data["toilet_id"] is None and "submitted_by" not in data
    assert data["has_disabled_access"] is True and data["is_free"] is None
    assert store["toilets"] == {}


def test_only_admin_moderates(env):
    client, _ = env
    suggestion_id = suggest(client).json()["id"]
    assert client.get("/api/v1/admin/suggestions", headers=token(U)).status_code == 403
    assert decide(client, suggestion_id, "approved", headers=token(U)).status_code == 403
    assert client.patch(f"/api/v1/admin/suggestions/{suggestion_id}", json={"status": "approved"}).status_code == 401
    assert decide(client, suggestion_id, "maybe").status_code == 422
    assert decide(client, str(uuid.uuid4()), "approved").status_code == 404
    listing = client.get("/api/v1/admin/suggestions", headers=token(ADMIN, "ADMIN")).json()
    assert listing["count"] == 1 and listing["results"][0]["id"] == suggestion_id


def test_approve_publishes_once_and_reject_stays_hidden(env):
    client, store = env
    approved_id, rejected_id = suggest(client).json()["id"], suggest(client, name="Gizli WC").json()["id"]
    approved = decide(client, approved_id, "APPROVED")
    assert approved.status_code == 200 and approved.json()["toilet_id"] == approved_id
    assert decide(client, rejected_id, "rejected").json()["status"] == "rejected"
    assert list(store["toilets"]) == [approved_id]
    toilet = store["toilets"][approved_id]
    assert (toilet["status"], toilet["source"], toilet["opening_hours"], toilet["is_free"]) == \
           ("ACTIVE", "suggestion", None, None)
    assert decide(client, approved_id, "rejected").status_code == 409
    assert decide(client, rejected_id, "approved").status_code == 409
    assert client.post(f"/api/v1/toilets/{approved_id}/reviews", headers=token(U),
                       json={"cleanliness_score": 5}).status_code == 201


def test_account_deletion_clears_suggestion_links(env):
    client, store = env
    suggestion_id = suggest(client).json()["id"]
    decide(client, suggestion_id, "approved")
    assert client.delete("/api/v1/users/me", headers=token(U)).status_code == 204
    assert store["suggestions"][suggestion_id]["submitted_by"] is None
    assert store["suggestions"][suggestion_id]["moderated_by"] == ADMIN
    assert suggestion_id in store["toilets"]


real_stack = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1",
    reason="Requires local PostgreSQL and MongoDB")


@pytest.fixture
def live(monkeypatch):
    from src.db import connect

    monkeypatch.setenv("SMARTLOO_MONGO_DB", f"smartloo_test_{uuid.uuid4().hex[:8]}")
    emails = [f"{n}-{uuid.uuid4().hex[:8]}@example.com" for n in ("user", "admin")]
    app = create_app(jwt_secret=KEY)
    with TestClient(app) as client:
        headers = []
        for email in emails:
            client.post("/api/v1/auth/register", json={"email": email, "password": "Guvenli123", "display_name": "Test"})
        with connect() as conn:
            conn.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (emails[1],))
        for email in emails:
            headers.append({"Authorization": "Bearer " + client.post(
                "/api/v1/auth/login", json={"email": email, "password": "Guvenli123"}).json()["access_token"]})
        created = []
        yield client, headers, created
    with connect() as conn:
        conn.execute("DELETE FROM suggestions WHERE id = ANY(%s::uuid[])", (created,))
        conn.execute("DELETE FROM toilets WHERE source = 'suggestion' AND id = ANY(%s::uuid[])", (created,))
        conn.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))


@real_stack
def test_moderation_on_real_postgres(live):
    from src.db import connect

    client, (user, admin), created = live
    good = suggest(client, headers=user, latitude=41.0005, longitude=29.0).json()
    hidden = suggest(client, headers=user, name="Gizli WC").json()
    created += [good["id"], hidden["id"]]
    search = {"lat": 41, "lon": 29, "radius": 1000}
    assert good["id"] not in [r["id"] for r in client.get("/api/v1/toilets/nearby", params=search).json()["results"]]

    with ThreadPoolExecutor(max_workers=2) as pool:  # concurrent approvals publish once
        statuses = sorted(r.status_code for r in pool.map(
            lambda _: decide(client, good["id"], "approved", headers=admin), range(2)))
    assert statuses == [200, 409]
    assert decide(client, hidden["id"], "rejected", headers=admin).status_code == 200
    assert good["id"] in [r["id"] for r in client.get("/api/v1/toilets/nearby", params=search).json()["results"]]
    with connect() as conn:
        assert conn.execute("SELECT count(*) AS n FROM toilets WHERE id = ANY(%s::uuid[])",
                            ([good["id"], hidden["id"]],)).fetchone()["n"] == 1

    assert client.delete("/api/v1/users/me", headers=user).status_code == 204
    with connect() as conn:
        row = conn.execute("SELECT submitted_by, moderated_by, status FROM suggestions WHERE id = %s",
                           (good["id"],)).fetchone()
    assert row["submitted_by"] is None and row["moderated_by"] is not None and row["status"] == "APPROVED"
