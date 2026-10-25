import os

import pytest
from fastapi.testclient import TestClient

from src.app import create_app


pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_POSTGIS") != "1",
    reason="Requires local PostGIS with synthetic fixtures",
)

BASE = "/api/v1/toilets/nearby"
A, B, C = [
    f"00000000-0000-4000-8000-{n:012}"
    for n in range(1, 4)
]


@pytest.mark.parametrize(
    "filters, expected_ids",
    [
        ({}, [A, C, B]),
        ({"open_now": True}, [A, B]),
        (
            {"has_disabled_access": True, "has_baby_changing": True},
            [A],
        ),
        ({"is_free": True}, [C, B]),
    ],
)
def test_postgis_search(filters, expected_ids):
    with TestClient(create_app()) as client:
        response = client.get(
            BASE,
            params={"lat": 41, "lon": 29, "radius": 1000, **filters},
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["count"] == len(expected_ids)
    assert [row["id"] for row in data["results"]] == expected_ids

    distances = [row["distance_m"] for row in data["results"]]
    assert distances == sorted(distances)
    assert distances[0] == pytest.approx(
        222 if filters.get("is_free") else 111,
        abs=3,
    )


def test_postgis_empty_result():
    with TestClient(create_app()) as client:
        response = client.get(
            BASE,
            params={"lat": 0, "lon": 0, "radius": 1000},
        )

    assert response.status_code == 200, response.text
    assert response.json() == {"count": 0, "results": []}