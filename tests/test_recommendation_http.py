"""Real PostGIS fallback recommendations, no model/provider involved."""
import os
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.db import connect


def test_ai_lifespan_keeps_admin_import_and_public_routes_registered():
    app = create_app(state={}, nearby_search=lambda **kwargs: [], ai_profile="")
    with TestClient(app) as client:
        assert app.state.summary_service is None
        assert client.post('/api/v1/admin/import', json=[]).status_code == 401
        assert client.get('/api/v1/toilets/not-a-uuid/summary').status_code == 422
        response = client.get('/api/v1/recommendations', params={"lat": 41, "lon": 29})
        assert response.status_code == 200
        assert response.json()["fallback"] is True
        assert response.json()["results"] == []
    assert app.state.summary_service is None


@pytest.fixture
def locations():
    if os.getenv("SMARTLOO_TEST_POSTGIS") != "1":
        pytest.skip("Explicit test PostGIS required")
    ids = [str(uuid.uuid4()) for _ in range(6)]
    values = [("ACTIVE", True, True, None, "24/7"),
              ("ACTIVE", False, False, True, "24/7"),
              ("CLOSED", True, True, True, "24/7"),
              (None, True, True, True, "24/7"),
              ("ACTIVE", None, None, None, None),
              ("ACTIVE", True, True, False, "24/7")]
    try:
        with connect() as conn:
            for i, (key, facts) in enumerate(zip(ids, values)):
                status, free, access, baby, hours = facts
                conn.execute("""INSERT INTO toilets(id,source,source_id,name,latitude,longitude,district,
                    status,is_free,has_disabled_access,has_baby_changing,opening_hours)
                    VALUES (%s,'recommendation-http',%s,%s,%s,11,'QA',%s,%s,%s,%s,%s)""",
                    (key, key, f"Candidate {i}", 11 + (i + 1) / 10000, status, free, access, baby, hours))
        with TestClient(create_app(ai_profile="")) as client:
            yield client, ids
    finally:
        with connect() as conn:
            conn.execute("DELETE FROM toilets WHERE id=ANY(%s::uuid[]) AND source='recommendation-http'", (ids,))


@pytest.mark.parametrize("filters,indexes", [({}, [0, 1, 4]), ({"open_now": True}, [0, 1, 5]),
    ({"is_free": True}, [0, 5]), ({"is_free": False}, [1]),
    ({"has_baby_changing": True}, [1]), ({"has_disabled_access": False}, [1]),
    ({"radius": 15}, [0]), ({"lat": 0, "lon": 0}, [])])
def test_recommendation_real_postgis_filters_and_distance(locations, filters, indexes):
    client, ids = locations
    result = client.get('/api/v1/recommendations', params={"lat": 11, "lon": 11, "radius": 100, **filters})
    assert result.status_code == 200, result.text
    data = result.json()
    assert [row["id"] for row in data["results"]] == [ids[i] for i in indexes]
    assert data["count"] <= 3
    assert data["ai_reasons_available"] is False and data["fallback"] is True
    assert data["message"]
    distances = [row["distance_m"] for row in data["results"]]
    assert distances == sorted(distances)
    assert all(row["status"] == "ACTIVE" and "reason" not in row for row in data["results"])
    assert all(row["average_cleanliness"] is None for row in data["results"])
    assert all(row["name"] and row["latitude"] and row["longitude"] for row in data["results"])


@pytest.mark.parametrize("params", [{}, {"lat": "nan", "lon": 11}, {"lat": 91, "lon": 11},
    {"lat": 11, "lon": 181}, {"lat": 11, "lon": 11, "radius": 0},
    {"lat": 11, "lon": 11, "radius": 50001}, {"lat": 11, "lon": 11, "is_free": "unknown"}])
def test_recommendation_invalid_input_does_not_call_discovery(params):
    def fail(**kwargs):
        raise AssertionError("Invalid request reached discovery")
    with TestClient(create_app(state={}, nearby_search=fail, ai_profile="")) as client:
        assert client.get('/api/v1/recommendations', params=params).status_code == 422


def test_recommendation_store_failure_is_not_an_empty_result():
    def fail(**kwargs):
        raise psycopg.OperationalError("synthetic unavailable PostGIS")
    with TestClient(create_app(state={}, nearby_search=fail, ai_profile="")) as client:
        assert client.get('/api/v1/recommendations', params={"lat": 11, "lon": 11}).status_code == 503
