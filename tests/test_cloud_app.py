import pytest
from fastapi.testclient import TestClient

from src.cloud_app import create_cloud_app


@pytest.fixture
def client(tmp_path):
    (tmp_path / "index.html").write_text("<html>SmartLoo test shell</html>", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("/* asset */", encoding="utf-8")
    app = create_cloud_app(web_dir=tmp_path, state={})
    with TestClient(app) as browser:
        yield browser


@pytest.mark.parametrize("path", ["/", "/sign-in", "/register", "/account", "/suggest", "/admin", "/admin/import"])
def test_direct_browser_navigation(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert "SmartLoo test shell" in response.text
    assert response.headers["content-type"].startswith("text/html")


@pytest.mark.parametrize("path", ["/api/v1/missing", "/assets/missing.js", "/missing"])
def test_missing_resources_are_not_successful_spa_pages(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert "SmartLoo test shell" not in response.text


def test_static_assets_and_liveness(client):
    assert client.get("/assets/app.js").text == "/* asset */"
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.head("/sign-in").status_code == 200
    assert client.post("/sign-in").status_code == 405


def test_api_validation_and_admin_guard_still_apply(client):
    assert client.get("/api/v1/toilets/nearby?lat=100&lon=29").status_code == 422
    assert client.get("/api/v1/admin/metrics/summary").status_code == 401


def test_missing_build_fails_before_serving(tmp_path):
    with pytest.raises(RuntimeError, match="index.html"):
        create_cloud_app(web_dir=tmp_path, state={})


@pytest.mark.parametrize("revision", ["a" * 40, "not-a-public-commit"])
def test_liveness_exposes_only_a_valid_public_release_revision(client, monkeypatch, revision):
    monkeypatch.setenv("RENDER_GIT_COMMIT", revision)
    expected = {"status": "ok", "revision": revision} if len(revision) == 40 else {"status": "ok"}
    assert client.get("/healthz").json() == expected
