import csv
from datetime import datetime, timedelta, timezone
from io import StringIO
from unittest.mock import Mock

import pytest
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from src.admin_analytics import AnalyticsUnavailable, ISTANBUL, create_analytics_router


SUMMARY = "/api/v1/admin/metrics/summary"
EXPORT = "/api/v1/admin/analytics/export"
ADMIN = {"Authorization": "Bearer test-admin"}
DATES = {"from": "2026-10-01", "to": "2026-10-03"}
FACILITIES = [
    {"id": "a", "district": "Kadıköy", "name": "A", "status": "ACTIVE"},
    {"id": "b", "district": "Kadıköy", "name": "B", "status": "CLOSED"},
    {"id": "c", "district": "Kadıköy", "name": "C", "status": "MAINTENANCE"},
    {"id": "d", "district": "Beşiktaş", "name": "D", "status": "ACTIVE"},
]


def review(facility_id, score, timestamp):
    return {"toilet_id": facility_id, "cleanliness_score": score,
            "created_at": datetime.fromisoformat(timestamp)}


@pytest.fixture
def analytics():
    reviews = [
        review("a", 1, "2026-09-30T20:59:59+00:00"),
        review("a", 5, "2026-09-30T21:00:00+00:00"),
        review("a", 5, "2026-10-01T10:00:00+00:00"),
        review("a", 5, "2026-10-01T20:00:00+00:00"),
        review("a", 5, "2026-10-02T21:00:00+00:00"),
        review("b", 1, "2026-10-03T20:59:59+00:00"),
        review("b", 5, "2026-10-03T21:00:00+00:00"),
        review("d", 1, "2026-10-03T20:00:00+00:00"),
    ]

    def require_admin(authorization: str | None = Header(None)):
        if authorization == "Bearer test-user":
            raise HTTPException(status_code=403)
        if authorization != ADMIN["Authorization"]:
            raise HTTPException(status_code=401)

    def find_facilities(district):
        return [row for row in FACILITIES if district is None or row["district"] == district]

    def find_reviews(ids, start, end):
        return [row for row in reviews if row["toilet_id"] in ids and start <= row["created_at"] < end]

    facilities_reader = Mock(side_effect=find_facilities)
    reviews_reader = Mock(side_effect=find_reviews)
    app = FastAPI()
    app.include_router(create_analytics_router(require_admin, facilities_reader, reviews_reader))
    with TestClient(app) as client:
        yield client, facilities_reader, reviews_reader, reviews


def test_weighted_mean_uses_istanbul_calendar_and_exact_district(analytics):
    client, _, reader, _ = analytics
    response = client.get(SUMMARY, headers=ADMIN, params={**DATES, "district": "Kadıköy"})
    assert response.status_code == 200, response.text
    assert response.json() == {
        "filters": {**DATES, "district": "Kadıköy", "timezone": "Europe/Istanbul"},
        "average_cleanliness": 4.2, "review_count": 5, "critical_alert": False,
        "critical_threshold": 3.5, "active_facility_ratio": {"active": 1, "total": 3},
        "trend": [
            {"date": "2026-10-01", "average_cleanliness": 5, "review_count": 3},
            {"date": "2026-10-02", "average_cleanliness": None, "review_count": 0},
            {"date": "2026-10-03", "average_cleanliness": 3, "review_count": 2},
        ],
        "facilities": [
            {"facility_id": key, "name": key.upper(), "district": "Kadıköy",
             "status": status, "hygiene_score": score, "review_count": count}
            for key, status, score, count in (
                ("a", "ACTIVE", 5, 4), ("b", "CLOSED", 1, 1), ("c", "MAINTENANCE", None, 0),
            )
        ],
    }
    reader.assert_called_once_with(
        ["a", "b", "c"], datetime(2026, 9, 30, 21, tzinfo=timezone.utc),
        datetime(2026, 10, 3, 21, tzinfo=timezone.utc),
    )


@pytest.mark.parametrize("last_score,alert", [(2, True), (3, False)])
def test_critical_threshold_is_strict(analytics, last_score, alert):
    client, _, _, reviews = analytics
    reviews[:] = [review("a", 4, "2026-10-01T00:00:00+00:00"),
                  review("a", last_score, "2026-10-01T00:00:00+00:00")]
    data = client.get(SUMMARY, headers=ADMIN, params=DATES).json()
    assert data["average_cleanliness"] == (4 + last_score) / 2
    assert data["critical_alert"] is alert


def test_export_has_same_selection_and_preserves_utf8(analytics):
    client, _, _, _ = analytics
    params = {**DATES, "district": "Kadıköy"}
    panel = client.get(SUMMARY, headers=ADMIN, params=params).json()
    export = client.get(EXPORT, headers=ADMIN, params={**params, "format": "json"})
    assert export.status_code == 200
    assert "filename*=UTF-8''smartloo-hygiene-Kad%C4%B1k%C3%B6y-2026-10-01_2026-10-03.json" in export.headers["content-disposition"]
    data = export.json()
    assert data["filters"] == panel["filters"]
    assert data["count"] == 3
    assert data["results"] == [
        {"facility_id": key, "district": "Kadıköy", "hygiene_score": score,
         "open_issues_count": None, "last_cleaned_at": None}
        for key, score in (("a", 5), ("b", 1), ("c", None))
    ]

    export = client.get(EXPORT, headers=ADMIN, params={**params, "format": "csv"})
    assert export.headers["content-type"] == "text/csv; charset=utf-8"
    assert "filename*=UTF-8''smartloo-hygiene-Kad%C4%B1k%C3%B6y-" in export.headers["content-disposition"]
    assert export.content.startswith(b"\xef\xbb\xbf")
    assert export.content.count(b"\r\n") == 4
    reader = csv.DictReader(StringIO(export.content.decode("utf-8-sig")))
    assert reader.fieldnames == ["facility_id", "district", "hygiene_score", "open_issues_count", "last_cleaned_at"]
    assert [(row["district"], row["hygiene_score"]) for row in reader] == [
        ("Kadıköy", "5.0"), ("Kadıköy", "1.0"), ("Kadıköy", ""),
    ]


def test_no_reviews_and_no_facilities_are_distinct(analytics):
    client, _, reader, reviews = analytics
    reviews.clear()
    data = client.get(SUMMARY, headers=ADMIN, params={**DATES, "district": "Kadıköy"}).json()
    assert data["average_cleanliness"] is None and data["review_count"] == 0
    assert not data["critical_alert"]
    assert len(data["facilities"]) == 3 and all(row["hygiene_score"] is None for row in data["facilities"])
    reader.reset_mock()
    params = {**DATES, "district": "Adalar"}
    data = client.get(SUMMARY, headers=ADMIN, params=params).json()
    assert data["facilities"] == [] and data["active_facility_ratio"] is None
    data = client.get(EXPORT, headers=ADMIN, params={**params, "format": "json"}).json()
    assert data["count"] == 0 and data["results"] == []
    export = client.get(EXPORT, headers=ADMIN, params={**params, "format": "csv"})
    assert len(export.content.splitlines()) == 1
    reader.assert_not_called()


def test_default_window_contains_30_istanbul_days(analytics):
    client, _, _, _ = analytics
    data = client.get(SUMMARY, headers=ADMIN).json()
    today = datetime.now(ISTANBUL).date()
    assert data["filters"]["to"] == today.isoformat()
    assert data["filters"]["from"] == (today - timedelta(days=29)).isoformat()
    assert len(data["trend"]) == 30


@pytest.mark.parametrize("params", [{}, {"format": "xlsx"}])
def test_export_requires_supported_format(analytics, params):
    client, reader, _, _ = analytics
    response = client.get(EXPORT, headers=ADMIN, params=params)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["query", "format"]
    reader.assert_not_called()


@pytest.mark.parametrize("params,field", [
    ({"from": "2026-10-01"}, "to"), ({"to": "2026-10-01"}, "from"),
    ({"from": "2026-10-04", "to": "2026-10-01"}, "to"),
    ({"from": "2026-02-30", "to": "2026-10-01"}, "from"),
    ({"from": "2026-10-01T00:00:00Z", "to": "2026-10-01"}, "from"),
    ({"from": "2026-10-01", "to": "9999-12-31"}, "to"),
])
def test_invalid_filters_name_the_field(analytics, params, field):
    client, reader, _, _ = analytics
    response = client.get(SUMMARY, headers=ADMIN, params=params)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["query", field]
    reader.assert_not_called()


@pytest.mark.parametrize("path", [SUMMARY, f"{EXPORT}?format=json"])
def test_both_routes_apply_admin_guard_before_reading_stores(analytics, path):
    client, reader, _, _ = analytics
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer test-user"}).status_code == 403
    reader.assert_not_called()


@pytest.mark.parametrize("store", [1, 2])
def test_store_failure_is_503_in_both_routes(analytics, store):
    client, _, _, _ = analytics
    analytics[store].side_effect = AnalyticsUnavailable("test store offline")
    assert client.get(SUMMARY, headers=ADMIN).status_code == 503
    assert client.get(EXPORT, headers=ADMIN, params={"format": "csv"}).status_code == 503


@pytest.mark.parametrize("path,extra", [(SUMMARY, {}), (EXPORT, {"format": "json"}), (EXPORT, {"format": "csv"})])
def test_inclusive_366_day_limit_before_store_access(analytics, path, extra):
    client, reader, _, _ = analytics
    allowed = client.get(path, headers=ADMIN, params={"from": "2024-01-01", "to": "2024-12-31", **extra})
    assert allowed.status_code == 200
    reader.reset_mock()
    rejected = client.get(path, headers=ADMIN, params={"from": "2024-01-01", "to": "2025-01-01", **extra})
    assert rejected.status_code == 422
    assert rejected.json()["detail"][0]["loc"] == ["query", "to"]
    reader.assert_not_called()


def test_memory_snapshot_guard_rejects_pending_and_releases_partial_locks():
    from src.review_coordination import MemoryReviewCoordination
    state = {"toilets": {"a": {}, "b": {}}}
    coordinator = MemoryReviewCoordination(state)
    with coordinator.guard("b") as writer:
        writer.begin("review", None)
        with coordinator.snapshot_guard(["a", "b"]) as ready:
            assert not ready
    with coordinator.guard("a", wait=False) as released:
        assert released is not None
    with coordinator.snapshot_guard(["a", "b"]) as ready:
        assert not ready  # durable pending marker remains after writer exits
    state["review_operations"].clear()
    with coordinator.snapshot_guard(["b", "a", "a"]) as ready:
        assert ready
