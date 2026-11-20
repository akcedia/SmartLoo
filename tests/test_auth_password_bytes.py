"""bcrypt's 72-byte input limit is enforced, never silently truncated (#56).

Isolated: runs on the in-memory account double, no database needed.
"""
import pytest
from fastapi.testclient import TestClient

from src.app import create_app

KEY = "requirements-test-only-signing-key-at-least-32-bytes"
AUTH = "/api/v1/auth"
EMAIL = "bytes@example.com"
# "ş" is 2 bytes in UTF-8: 2 + 35 * 2 = exactly 72 bytes.
AT_LIMIT = "a1" + "ş" * 35


@pytest.fixture
def client():
    with TestClient(create_app({"users": {}, "login_attempts": []}, jwt_secret=KEY)) as c:
        yield c


def register(client, password):
    return client.post(f"{AUTH}/register",
                       json={"email": EMAIL, "password": password, "display_name": "Byte Test"})


def login(client, password):
    return client.post(f"{AUTH}/login", json={"email": EMAIL, "password": password})


def test_password_of_exactly_72_bytes_with_multibyte_characters_works(client):
    assert len(AT_LIMIT.encode()) == 72
    assert register(client, AT_LIMIT).status_code == 201
    assert login(client, AT_LIMIT).status_code == 200


@pytest.mark.parametrize("password", [AT_LIMIT + "x", "a1" + "ş" * 35 + "ğ", "a1" + "x" * 71])
def test_registration_rejects_more_than_72_bytes(client, password):
    assert len(password.encode()) > 72
    response = register(client, password)
    assert response.status_code == 422
    assert "72 bytes" in response.text


@pytest.mark.parametrize("suffix", ["x", "ş", "anything-after-the-limit"])
def test_longer_password_sharing_the_first_72_bytes_does_not_sign_in(client, suffix):
    register(client, AT_LIMIT)
    response = login(client, AT_LIMIT + suffix)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_overlong_login_counts_as_a_failed_attempt(client):
    register(client, AT_LIMIT)
    statuses = [login(client, AT_LIMIT + "x").status_code for _ in range(6)]
    assert statuses == [401] * 5 + [429]
