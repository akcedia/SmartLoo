"""FR-08 registration, sign-in and guards against real PostgreSQL (db/migrations/003_create_users.sql).

Run after migrate.sh with SMARTLOO_TEST_POSTGIS=1. Each test uses a fresh random email,
so the suite can run repeatedly on the same database.
"""
import os
import uuid

import bcrypt
import jwt
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.db import connect

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1",
    reason="Requires local PostgreSQL with migrations applied",
)

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
PASSWORD = "Guvenli123"
AUTH = "/api/v1/auth"


@pytest.fixture
def client():
    with TestClient(create_app(jwt_secret=KEY)) as c:
        yield c


@pytest.fixture
def email():
    address = f"user-{uuid.uuid4().hex[:12]}@example.com"
    yield address
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE email = %s", (address,))
        conn.execute("DELETE FROM login_failures WHERE email = %s", (address,))


def register(client, email, **extra):
    return client.post(f"{AUTH}/register", json={"email": email, "password": PASSWORD,
                                                 "display_name": "Test User", **extra})


def login(client, email, password=PASSWORD):
    return client.post(f"{AUTH}/login", json={"email": email, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_stores_hash_and_user_role(client, email):
    response = register(client, email.upper(), role="ADMIN")
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["email"] == email and data["role"] == "USER"
    assert "password_hash" not in data
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
    assert row["role"] == "USER"
    assert row["password_hash"] != PASSWORD
    assert bcrypt.checkpw(PASSWORD.encode(), row["password_hash"].encode())


def test_duplicate_email_is_case_insensitive(client, email):
    assert register(client, email).status_code == 201
    assert register(client, email.upper()).status_code == 409


@pytest.mark.parametrize("password", ["abc", "abcdefgh", "12345678"])
def test_weak_password_is_rejected_and_not_saved(client, email, password):
    response = client.post(f"{AUTH}/register", json={"email": email, "password": password,
                                                     "display_name": "Test User"})
    assert response.status_code == 422
    with connect() as conn:
        assert conn.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone() is None


def test_login_issues_60_minute_jwt(client, email):
    user_id = register(client, email).json()["id"]
    response = login(client, email)
    assert response.status_code == 200, response.text
    data = response.json()
    claims = jwt.decode(data["access_token"], KEY, algorithms=["HS256"])
    assert claims["sub"] == user_id and claims["role"] == "USER"
    assert claims["exp"] - claims["iat"] == 3600
    assert data["token_type"] == "Bearer" and data["expires_in"] == 3600


def test_generic_401_and_throttling(client, email):
    register(client, email)
    wrong = login(client, email, "Wrong123")
    unknown = login(client, f"absent-{email}")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "Invalid email or password"
    statuses = [login(client, email, "Wrong123").status_code for _ in range(5)]
    assert statuses == [401, 401, 401, 401, 429]
    assert login(client, email).status_code == 429  # blocked even with the right password until expiry


def test_guards_return_401_then_403(client, email):
    register(client, email)
    token = login(client, email).json()["access_token"]
    admin_route = "/api/v1/admin/metrics/summary"
    assert client.get(admin_route).status_code == 401
    assert client.get(admin_route, headers=bearer(token + "x")).status_code == 401
    assert client.get(admin_route, headers=bearer(token)).status_code == 403
    with connect() as conn:
        conn.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (email,))
    # The guard passes; the analytics feature itself is not implemented yet.
    assert client.get(admin_route, headers=bearer(token)).status_code == 501


def test_token_of_deleted_account_is_rejected(client, email):
    register(client, email)
    token = login(client, email).json()["access_token"]
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE email = %s", (email,))
    assert client.delete("/api/v1/users/me", headers=bearer(token)).status_code == 401
