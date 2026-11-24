"""The unknown-email timing equalizer is random per process, not a password literal (#56, Sonar).

Isolated: in-memory account store, no database needed.
"""
import subprocess
import sys

import bcrypt
from fastapi.testclient import TestClient

from src import auth
from src.app import create_app

KEY = "requirements-test-only-signing-key-at-least-32-bytes"


def test_dummy_hash_is_a_valid_bcrypt_hash_of_no_known_value():
    assert auth.DUMMY_HASH.startswith("$2b$12$")
    assert not bcrypt.checkpw(b"timing-equalizer", auth.DUMMY_HASH.encode())  # the former literal
    assert not bcrypt.checkpw(b"", auth.DUMMY_HASH.encode())


def test_dummy_hash_differs_between_processes():
    command = [sys.executable, "-c", "from src.auth import DUMMY_HASH; print(DUMMY_HASH)"]
    first, second = (subprocess.run(command, capture_output=True, text=True, check=True).stdout for _ in range(2))
    assert first.strip() and first != second


def test_unknown_email_still_gets_the_generic_401_and_counts_as_failure():
    state = {"users": {}, "login_attempts": []}
    with TestClient(create_app(state, jwt_secret=KEY)) as client:
        response = client.post("/api/v1/auth/login", json={"email": "absent@example.com", "password": "Guvenli123"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"
        assert len(client.app.state.repository["login_attempts"]) == 1
