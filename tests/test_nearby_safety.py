"""Public nearby boundary and failure-response checks; no live DB required."""

from unittest.mock import Mock

import psycopg
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.nearby_store import find_nearby


INVALID_QUERY = [
    {"lat": value} for value in (-91, 91, "NaN", "Infinity", "-Infinity", "1; DROP TABLE toilets")
] + [
    {"lon": value} for value in (-181, 181, "NaN", "Infinity", "-Infinity")
] + [
    {"radius": value} for value in (0, -50, 50001, "NaN", "Infinity", "-Infinity", "abc")
] + [
    {field: "not-a-boolean"}
    for field in ("open_now", "has_disabled_access", "has_baby_changing", "is_free")
]


@pytest.mark.parametrize("override", INVALID_QUERY)
def test_invalid_nearby_input_cannot_reach_store(override):
    provider = Mock(return_value=[])
    app = create_app(nearby_search=provider)
    with TestClient(app) as client:
        response = client.get("/api/v1/toilets/nearby", params={"lat": 41, "lon": 29, **override})
    assert response.status_code == 422
    assert response.json()["detail"]
    provider.assert_not_called()
    assert app.state.repository == {}


@pytest.mark.parametrize("missing", ["lat", "lon"])
def test_missing_coordinate_cannot_reach_store(missing):
    provider = Mock(return_value=[])
    query = {"lat": 41, "lon": 29}
    del query[missing]
    with TestClient(create_app(nearby_search=provider)) as client:
        response = client.get("/api/v1/toilets/nearby", params=query)
    assert response.status_code == 422
    provider.assert_not_called()


@pytest.mark.parametrize("lat,lon,radius", [(-90, -180, 1), (90, 180, 50000)])
def test_documented_boundaries_remain_usable(lat, lon, radius):
    provider = Mock(return_value=[])
    with TestClient(create_app(nearby_search=provider)) as client:
        response = client.get("/api/v1/toilets/nearby", params={"lat": lat, "lon": lon, "radius": radius})
    assert response.status_code == 200
    assert response.json() == {"count": 0, "results": []}
    assert provider.call_args.kwargs["radius"] == radius


@pytest.mark.parametrize("error_type", [psycopg.OperationalError, psycopg.InterfaceError])
def test_database_failure_response_does_not_disclose_connection_details(error_type):
    provider = Mock(side_effect=error_type("qa-only-password DB host and internal query"))
    with TestClient(create_app(nearby_search=provider)) as client:
        response = client.get("/api/v1/toilets/nearby", params={"lat": 41, "lon": 29})
    assert response.status_code == 503
    assert response.json() == {"detail": "Database temporarily unavailable"}
    assert "qa-only-password" not in response.text


def test_nearby_connection_uses_ipv4_by_default_and_honors_override(monkeypatch):
    # Capture configuration at the actual driver boundary, before any network IO.
    connect = Mock(side_effect=psycopg.OperationalError("isolated QA stop"))
    monkeypatch.setattr("src.nearby_store.psycopg.connect", connect)
    monkeypatch.delenv("SMARTLOO_DB_HOST", raising=False)
    with pytest.raises(psycopg.OperationalError):
        find_nearby(41, 29)
    assert connect.call_args.kwargs["host"] == "127.0.0.1"
    monkeypatch.setenv("SMARTLOO_DB_HOST", "postgres.qa.invalid")
    with pytest.raises(psycopg.OperationalError):
        find_nearby(41, 29)
    assert connect.call_args.kwargs["host"] == "postgres.qa.invalid"
