"""Real route/auth/PostGIS/Mongo analytics with private, cleaned-up synthetic data."""
import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import StringIO
import os
from threading import Event
import uuid

from fastapi.testclient import TestClient
import pymongo
import psycopg
import pytest

from src.app import create_app
from src.db import connect
from src import analytics_store
from src.review_coordination import PostgresReviewCoordination

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1",
    reason="Explicit test PostgreSQL/Mongo opt-in required",
)
SUMMARY = "/api/v1/admin/metrics/summary"
EXPORT = "/api/v1/admin/analytics/export"
KEY = "analytics-test-only-signing-key-at-least-32-bytes"


@pytest.fixture
def live(monkeypatch):
    marker = uuid.uuid4().hex
    district = f"QA Kadıköy {marker}"
    ids = [str(uuid.uuid4()) for _ in range(4)]
    db_name = f"smartloo_analytics_test_{marker}"
    monkeypatch.setenv("SMARTLOO_MONGO_DB", db_name)
    mongo = pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://127.0.0.1:27017"), tz_aware=True)
    collection = mongo[db_name]["reviews"]
    emails = []
    app = create_app(jwt_secret=KEY)
    try:
        with connect() as conn:
            for i, key in enumerate(ids):
                conn.execute("""INSERT INTO toilets
                    (id, source, source_id, name, latitude, longitude, district, status, opening_hours)
                    VALUES (%s, 'analytics-test', %s, %s, 41, 29, %s, %s, '24/7')""",
                    (key, key, f"Analytics {i}", district if i < 3 else f"Other {marker}",
                     ["ACTIVE", "ACTIVE", "CLOSED", "ACTIVE"][i]))
        with TestClient(app) as client:
            tokens = {}
            for role in ("USER", "ADMIN"):
                email = f"analytics-{role.lower()}-{marker}@example.com"
                emails.append(email)
                registered = client.post("/api/v1/auth/register", json={
                    "email": email, "password": "Guvenli123", "display_name": role,
                })
                assert registered.status_code == 201, registered.text
                if role == "ADMIN":
                    with connect() as conn:
                        conn.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (email,))
                login = client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"})
                assert login.status_code == 200, login.text
                tokens[role] = {"Authorization": f"Bearer {login.json()['access_token']}"}
            yield app, client, ids, district, collection, tokens
    finally:
        mongo.drop_database(db_name)
        mongo.close()
        with connect() as conn:
            conn.execute("DELETE FROM review_operations WHERE toilet_id = ANY(%s::uuid[])", (ids,))
            conn.execute("DELETE FROM toilets WHERE id = ANY(%s::uuid[])", (ids,))
            conn.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))


def request(live, path=SUMMARY, **params):
    _, client, _, district, _, tokens = live
    return client.get(path, headers=tokens["ADMIN"], params={"district": district, **params})


def test_live_admin_auth_and_single_route_registration(live):
    app, client, _, district, _, tokens = live
    for path, extra in [(SUMMARY, {}), (EXPORT, {"format": "csv"}), (EXPORT, {"format": "json"})]:
        params = {"district": district, **extra}
        assert client.get(path, params=params).status_code == 401
        assert client.get(path, params=params, headers={"Authorization": "Bearer invalid"}).status_code == 401
        assert client.get(path, params=params, headers=tokens["USER"]).status_code == 403
        assert client.get(path, params=params, headers=tokens["ADMIN"]).status_code == 200
    for path in (SUMMARY, EXPORT):
        # FastAPI includes routers lazily. The old explicitly registered 501
        # routes must be gone; the actual requests above prove router dispatch.
        assert not any(getattr(route, "path", None) == path for route in app.routes)


def test_live_weighted_mean_istanbul_boundary_and_downloads(live):
    _, _, ids, district, collection, _ = live
    documents = [(ids[0], 1, "2026-09-30T20:59:59+00:00"),
                 *[(ids[0], 5, "2026-09-30T21:00:00+00:00") for _ in range(4)],
                 (ids[1], 1, "2026-10-01T20:59:59+00:00"),
                 (ids[1], 5, "2026-10-01T21:00:00+00:00"),
                 (ids[3], 1, "2026-10-01T10:00:00+00:00")]
    collection.insert_many([{"id": str(uuid.uuid4()), "toilet_id": key, "user_id": None,
                             "cleanliness_score": score, "comment": "private@example.com",
                             "created_at": datetime.fromisoformat(at)} for key, score, at in documents])
    params = {"from": "2026-10-01", "to": "2026-10-01"}
    summary = request(live, **params)
    assert summary.status_code == 200, summary.text
    data = summary.json()
    assert data["average_cleanliness"] == 4.2 and data["review_count"] == 5
    assert data["critical_alert"] is False
    assert data["trend"] == [{"date": "2026-10-01", "average_cleanliness": 4.2, "review_count": 5}]
    assert [row["hygiene_score"] for row in data["facilities"]] == [5, 1, None]
    for format in ("csv", "json"):
        export = request(live, EXPORT, format=format, **params)
        assert export.status_code == 200
        assert "Kad%C4%B1k%C3%B6y" in export.headers["content-disposition"]
        assert f"2026-10-01_2026-10-01.{format}" in export.headers["content-disposition"]
        assert "private@example.com" not in export.text
        assert "user_id" not in export.text and "comment" not in export.text
        if format == "json":
            assert export.json()["filters"] == data["filters"]
            assert [row["hygiene_score"] for row in export.json()["results"]] == [5, 1, None]
        else:
            assert export.content.startswith(b"\xef\xbb\xbf")
            rows = list(csv.DictReader(StringIO(export.content.decode("utf-8-sig"))))
            assert [row["hygiene_score"] for row in rows] == ["5.0", "1.0", ""]
            assert all(row["district"] == district and row["last_cleaned_at"] == "" for row in rows)


def test_live_no_reviews_keeps_facilities_and_empty_district_is_empty(live):
    response = request(live)
    assert response.status_code == 200
    data = response.json()
    assert data["average_cleanliness"] is None and data["review_count"] == 0
    assert len(data["facilities"]) == 3 and len(data["trend"]) == 30
    assert all(row["average_cleanliness"] is None for row in data["trend"])
    empty = request(live, district="missing-test-district").json()
    assert empty["facilities"] == [] and empty["average_cleanliness"] is None


def test_live_crud_changes_summary_and_export(live):
    _, client, ids, _, _, tokens = live
    url = f"/api/v1/toilets/{ids[0]}/reviews"
    created = client.post(url, headers=tokens["USER"], json={"cleanliness_score": 2})
    assert created.status_code == 201, created.text
    summary = request(live).json()
    assert summary["average_cleanliness"] == 2 and summary["critical_alert"] is True
    assert request(live, EXPORT, format="json").json()["results"][0]["hygiene_score"] == 2
    review_url = f"/api/v1/reviews/{created.json()['id']}"
    assert client.patch(review_url, headers=tokens["USER"], json={"cleanliness_score": 5}).status_code == 200
    assert request(live).json()["average_cleanliness"] == 5
    assert request(live, EXPORT, format="json").json()["results"][0]["hygiene_score"] == 5
    assert client.delete(review_url, headers=tokens["USER"]).status_code == 204
    assert request(live).json()["average_cleanliness"] is None
    assert request(live, EXPORT, format="json").json()["results"][0]["hygiene_score"] is None


def test_live_range_validation_without_loosening_server_limit(live):
    for format in (None, "csv", "json"):
        path = EXPORT if format else SUMMARY
        extra = {"format": format} if format else {}
        assert request(live, path, **{"from": "2024-01-01", "to": "2024-12-31", **extra}).status_code == 200
        for dates in ({"from": "2024-01-01", "to": "2025-01-01"}, {"from": "2026-01-01"},
                      {"from": "2026-02-01", "to": "2026-01-01"}):
            rejected = request(live, path, **{**dates, **extra})
            assert rejected.status_code == 422


def test_live_mongo_outage_is_503_and_guards_are_released(live, monkeypatch):
    _, _, ids, _, _, _ = live
    with pymongo.MongoClient("mongodb://127.0.0.1:1", serverSelectionTimeoutMS=100) as offline:
        monkeypatch.setattr(analytics_store, "review_collection", lambda: offline["offline"]["reviews"])
        for path, extra in [(SUMMARY, {}), (EXPORT, {"format": "json"}), (EXPORT, {"format": "csv"})]:
            response = request(live, path, **extra)
            assert response.status_code == 503
            assert "content-disposition" not in response.headers
    with PostgresReviewCoordination().guard(ids[0], wait=False) as released:
        assert released is not None


def test_live_facility_store_outage_is_503_not_empty(live, monkeypatch):
    monkeypatch.setattr(analytics_store, "connect", lambda: psycopg.connect(
        host="127.0.0.1", port=1, connect_timeout=1,
    ))
    for path, extra in [(SUMMARY, {}), (EXPORT, {"format": "json"}), (EXPORT, {"format": "csv"})]:
        response = request(live, path, **extra)
        assert response.status_code == 503
        assert "content-disposition" not in response.headers


@pytest.mark.parametrize("state", ["writing", "repair_required"])
def test_live_durable_pending_suppresses_all_analytics(live, state):
    _, _, ids, _, _, _ = live
    with PostgresReviewCoordination().guard(ids[0]) as session:
        session.begin(str(uuid.uuid4()), None)
        if state == "repair_required":
            session.repair_required()
    for path, extra in [(SUMMARY, {}), (EXPORT, {"format": "json"}), (EXPORT, {"format": "csv"})]:
        assert request(live, path, **extra).status_code == 503


def test_live_writer_dirty_window_never_leaks_into_analytics(live, monkeypatch):
    app, client, ids, _, _, tokens = live
    dirty, proceed = Event(), Event()
    original = app.state.reviews.toilets.recompute
    def pause(*args, **kwargs):
        dirty.set()
        assert proceed.wait(10)
        return original(*args, **kwargs)
    monkeypatch.setattr(app.state.reviews.toilets, "recompute", pause)
    with ThreadPoolExecutor() as pool:
        writer = pool.submit(client.post, f"/api/v1/toilets/{ids[0]}/reviews",
                             headers=tokens["USER"], json={"cleanliness_score": 1})
        try:
            assert dirty.wait(10)
            assert request(live).status_code == 503
            assert request(live, EXPORT, format="json").status_code == 503
        finally:
            proceed.set()
        assert writer.result(timeout=10).status_code == 201
    assert request(live).json()["average_cleanliness"] == 1


def test_live_snapshot_blocks_writers_until_scores_collected(live, monkeypatch):
    app, _, ids, _, _, _ = live
    entered, proceed = Event(), Event()
    original = app.state.analytics_read_reviews
    def pause(*args):
        entered.set()
        assert proceed.wait(10)
        return original(*args)
    monkeypatch.setattr(app.state, "analytics_read_reviews", pause)
    with ThreadPoolExecutor() as pool:
        reader = pool.submit(request, live)
        try:
            assert entered.wait(10)
            with PostgresReviewCoordination().guard(ids[0], wait=False) as writer:
                assert writer is None
        finally:
            proceed.set()
        assert reader.result(timeout=10).status_code == 200
    with PostgresReviewCoordination().guard(ids[0], wait=False) as released:
        assert released is not None


def test_citywide_guard_uses_one_connection_for_500_facilities(monkeypatch):
    import src.review_coordination as coordination
    real_connect, calls = coordination.connect, []
    def count_connection():
        connection = real_connect()
        calls.append(connection)
        return connection
    monkeypatch.setattr(coordination, "connect", count_connection)
    ids = [str(uuid.uuid4()) for _ in range(500)]
    with PostgresReviewCoordination().snapshot_guard(ids) as ready:
        assert ready
    assert len(calls) == 1 and calls[0].closed
