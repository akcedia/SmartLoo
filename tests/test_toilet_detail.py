import os
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.nearby_store import _connect


BASE = "/api/v1/toilets"
FIXTURE_CLOSED = "00000000-0000-4000-8000-000000000003"
FIXTURE_UNKNOWN = "00000000-0000-4000-8000-000000000103"
requires_postgis = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1",
    reason="Requires local PostGIS with synthetic fixtures",
)


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def test_invalid_toilet_id_returns_422_without_reading_store(client, monkeypatch):
    def unexpected_lookup(toilet_id):
        pytest.fail("Invalid ID must be rejected before the database lookup")

    monkeypatch.setattr("src.app.find_toilet", unexpected_lookup)
    assert client.get(f"{BASE}/invalid-id").status_code == 422


def test_unavailable_database_returns_503(client, monkeypatch):
    def unavailable(toilet_id):
        raise psycopg.OperationalError("database offline")

    monkeypatch.setattr("src.app.find_toilet", unavailable)
    response = client.get(f"{BASE}/{FIXTURE_UNKNOWN}")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database temporarily unavailable"}


@requires_postgis
def test_unknown_toilet_id_returns_404(client):
    response = client.get(f"{BASE}/{uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Toilet not found"}


@requires_postgis
def test_unknown_operating_fields_stay_null(client):
    response = client.get(f"{BASE}/{FIXTURE_UNKNOWN}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == FIXTURE_UNKNOWN
    assert data["district"] == "Üsküdar"
    assert data["latitude"] == pytest.approx(41.0515)
    assert data["longitude"] == pytest.approx(29.05)
    for field in (
        "address", "has_disabled_access", "has_baby_changing", "is_free",
        "price_try", "opening_hours", "is_open_now", "average_cleanliness",
    ):
        assert data[field] is None
    assert data["review_count"] == 0
    assert "distance_m" not in data


@requires_postgis
def test_closed_facility_has_details_but_is_never_open(client):
    response = client.get(f"{BASE}/{FIXTURE_CLOSED}")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CLOSED"
    assert response.json()["is_open_now"] is False


@requires_postgis
def test_detail_reads_current_review_aggregates(client):
    toilet_id = uuid4()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO toilets (id, source, source_id, name, latitude, longitude,
                                 district, opening_hours)
            VALUES (%s, 'tests', %s, 'Detail test', 41, 29, 'Kadıköy', '24/7')
            """,
            (toilet_id, str(toilet_id)),
        )

    try:
        initial = client.get(f"{BASE}/{toilet_id}")
        assert initial.status_code == 200, initial.text
        assert initial.json()["is_open_now"] is True
        assert initial.json()["average_cleanliness"] is None
        assert initial.json()["review_count"] == 0

        with _connect() as conn:
            conn.execute(
                "UPDATE toilets SET average_cleanliness = 4.25, review_count = 4 WHERE id = %s",
                (toilet_id,),
            )

        updated = client.get(f"{BASE}/{toilet_id}")
        assert updated.status_code == 200, updated.text
        assert updated.json()["average_cleanliness"] == 4.25
        assert updated.json()["review_count"] == 4
    finally:
        with _connect() as conn:
            conn.execute("DELETE FROM toilets WHERE id = %s", (toilet_id,))
