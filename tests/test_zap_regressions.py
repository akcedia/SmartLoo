"""ZAP-discovered input boundary and browser header regressions (FR-08/NFR-04)."""
import base64
import hashlib

import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.cloud_app import create_cloud_app

KEY = "zap-regression-tests-only-at-least-thirty-two-bytes"


@pytest.mark.parametrize("email", ["x" * 255, "İ" * 128 + "@example.com", "a\x00@example.com"])
def test_login_rejects_unsafe_email_before_repository_access(email):
    state = {"users": {}, "login_attempts": []}
    with TestClient(create_app(state, jwt_secret=KEY)) as client:
        response = client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"})
    assert response.status_code == 422
    assert state["login_attempts"] == []


def test_registration_rejects_embedded_nul():
    with TestClient(create_app({}, jwt_secret=KEY)) as client:
        response = client.post("/api/v1/auth/register", json={"email": "a\x00@example.com", "password": "Guvenli123", "display_name": "Test User"})
    assert response.status_code == 422


def test_normalized_maximum_length_login_keeps_generic_401():
    email = "a" * 242 + "@example.com"
    assert len(email) == 254
    state = {"users": {}, "login_attempts": []}
    with TestClient(create_app(state, jwt_secret=KEY)) as client:
        response = client.post("/api/v1/auth/login", json={"email": email.upper(), "password": "Guvenli123"})
        attempts = client.app.state.repository["login_attempts"]
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
    assert len(attempts) == 1


@pytest.fixture
def web_client(tmp_path):
    (tmp_path / "index.html").write_text('<html><script>window.theme="light";</script><script src="/assets/app.js"></script></html>', encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets/app.js").write_text("/* app */", encoding="utf-8")
    with TestClient(create_cloud_app(tmp_path, state={}, jwt_secret=KEY)) as client:
        yield client


@pytest.mark.parametrize("path,status", [("/", 200), ("/sign-in", 200), ("/assets/app.js", 200), ("/missing", 404), ("/api/v1/toilets/nearby?lat=100&lon=29", 422), ("/api/v1/admin/metrics/summary", 401)])
def test_security_headers_cover_pages_assets_and_api_errors(web_client, path, status):
    response = web_client.get(path)
    assert response.status_code == status
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    policy = response.headers["content-security-policy"]
    assert "frame-ancestors 'none'" in policy and "object-src 'none'" in policy
    script_policy = next(part for part in policy.split(";") if part.strip().startswith("script-src "))
    assert "'unsafe-inline'" not in script_policy and "'unsafe-eval'" not in script_policy


def test_theme_script_hash_and_external_module_remain_allowed(web_client):
    response = web_client.get("/")
    digest = base64.b64encode(hashlib.sha256(b'window.theme="light";').digest()).decode()
    assert "'sha256-" + digest + "'" in response.headers["content-security-policy"]
    assert 'src="/assets/app.js"' in response.text


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/docs/oauth2-redirect"])
def test_framework_docs_keep_their_trusted_inline_scripts(web_client, path):
    response = web_client.get(path)
    assert response.status_code == 200
    if path != "/redoc":
        assert "'sha256-" in response.headers["content-security-policy"]
    assert "https://cdn.jsdelivr.net" in response.headers["content-security-policy"]
