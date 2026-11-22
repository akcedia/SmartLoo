"""HTTP-level grounded reasons; injected providers, no external model calls."""
import asyncio
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
import pytest

from src.app import create_app
from src.ai_gemini import GeminiRecommendationProvider, MODEL


def row(key="A", **changes):
    return dict(id=key, name="Sentetik tesis", latitude=41, longitude=29, district="QA",
                address=None, status="ACTIVE", opening_hours=None, is_open_now=None,
                price_try=None, review_count=0, distance_m=50, average_cleanliness=None,
                **({"is_free": True, "has_disabled_access": True, "has_baby_changing": None} | changes))


def call(provider, rows=None):
    app = create_app(state={}, nearby_search=lambda **kwargs: rows if rows is not None else [row()], ai_profile="")
    with TestClient(app) as client:
        app.state.recommendation_reason_provider = provider
        response = client.get("/api/v1/recommendations", params={"lat": 41, "lon": 29})
        assert response.status_code == 200
        return response.json()


def test_verified_reason_is_exposed_with_success_contract():
    provider = AsyncMock(return_value={"c1": "Tesis ücretsiz ve engelli erişimine uygun."})
    result = call(provider)
    assert result["ai_reasons_available"] is True
    assert result["fallback"] is False and result["message"] is None
    assert result["results"][0]["reason"] == "Tesis ücretsiz ve engelli erişimine uygun."
    assert result["results"][0]["name"] == "Sentetik tesis"
    assert result["results"][0]["id"] == "A"
    provider.assert_awaited_once()
    assert "id" not in provider.call_args.args[0][0]


@pytest.mark.parametrize("response", [{"c1": "Tesis güvenlidir."}, {"wrong": "Tesis ücretsiz."}])
def test_unverified_reason_keeps_identical_eligible_candidates(response):
    provider = AsyncMock(return_value=response)
    result = call(provider)
    provider.assert_awaited_once()
    assert result["fallback"] and not result["ai_reasons_available"]
    assert [item["id"] for item in result["results"]] == ["A"]
    assert "reason" not in result["results"][0]


def test_unknown_source_facts_make_no_model_request():
    transport = AsyncMock()
    provider = GeminiRecommendationProvider(transport, api_key="test-key", model=MODEL)
    result = call(provider, [row(is_free=None, has_disabled_access=None)])
    transport.post.assert_not_awaited()
    assert result["fallback"] and result["count"] == 1


def test_discovery_is_off_event_loop_and_timeout_keeps_candidates(monkeypatch):
    from src import ai_routes
    monkeypatch.setattr(ai_routes, "RECOMMENDATION_TIMEOUT_SECONDS", 0.15, raising=False)
    flags = {"cancelled": False, "off_loop": False}

    def discovery(**kwargs):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            flags["off_loop"] = True
        return [row()]

    async def delayed(evidence):
        try:
            await asyncio.sleep(5)
        finally:
            flags["cancelled"] = True

    app = create_app(state={}, nearby_search=discovery, ai_profile="")
    with TestClient(app) as client:
        app.state.recommendation_reason_provider = delayed
        result = client.get("/api/v1/recommendations", params={"lat": 41, "lon": 29}).json()
    assert flags == {"cancelled": True, "off_loop": True}
    assert result["fallback"] and [item["id"] for item in result["results"]] == ["A"]
