"""Synthetic Gemini transport/runtime; full HTTP test dependencies, no live network."""
import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.ai_gemini import GeminiSummaryProvider, MODEL
from src.ai_openai import ProviderError
from src.ai_restricted_policy import POLICY_VERSION
from src.app import create_app
from tests.test_ai_openai import EVIDENCE, OUTPUT


def reply(body=None, status=200):
    if body is None:
        body = {"candidates": [{"finishReason": "STOP", "content": {
            "role": "model", "parts": [{"text": json.dumps(OUTPUT)}]}}]}
    return SimpleNamespace(status_code=status, content=json.dumps(body).encode(), json=lambda: deepcopy(body))


@pytest.fixture
def client():
    return SimpleNamespace(post=AsyncMock(return_value=reply()))


def run(client, evidence=EVIDENCE):
    return asyncio.run(GeminiSummaryProvider(client, api_key="synthetic-gemini-key", model=MODEL)(evidence))


def test_gemini_uses_fixed_host_header_key_bounded_schema_and_no_tools(client):
    assert run(client) == OUTPUT
    client.post.assert_awaited_once()
    args, options = client.post.call_args
    assert args == (f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",)
    assert options["headers"] == {"x-goog-api-key": "synthetic-gemini-key"}
    assert options["follow_redirects"] is False and options["timeout"] == 8
    payload = options["json"]
    assert json.loads(payload["contents"][0]["parts"][0]["text"])["reviews"] == EVIDENCE
    assert payload["generationConfig"]["maxOutputTokens"] == 1200
    assert payload["generationConfig"]["responseJsonSchema"]["additionalProperties"] is False
    assert "synthetic-gemini-key" not in json.dumps(payload)
    assert "tools" not in payload


@pytest.mark.parametrize("status", [301, 401, 429, 500])
def test_gemini_errors_have_no_retry_paid_fallback_or_private_body(client, status):
    client.post.return_value = reply({"error": "private response"}, status=status)
    with pytest.raises(ProviderError, match="^gemini_http_error$"):
        run(client)
    client.post.assert_awaited_once()


@pytest.mark.parametrize("body", [
    {}, {"promptFeedback": {"blockReason": "SAFETY"}},
    {"candidates": [{"finishReason": "MAX_TOKENS"}]},
    {"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": [{"functionCall": {}}]}}]},
    {"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": [{"text": "private invalid JSON"}]}}]},
])
def test_gemini_rejects_blocked_truncated_tool_and_invalid_outputs(client, body):
    client.post.return_value = reply(body)
    with pytest.raises(ProviderError):
        run(client)


def test_gemini_rejects_identity_bearing_input_before_network(client):
    with pytest.raises(ValueError):
        run(client, [{**row, "user_id": "private"} for row in EVIDENCE])
    client.post.assert_not_awaited()


def test_gemini_accepts_opaque_thought_signature_but_never_returns_it(client):
    client.post.return_value = reply({"candidates": [{"finishReason": "STOP", "content": {
        "role": "model", "parts": [{"text": json.dumps(OUTPUT), "thoughtSignature": "opaque"}]}}]})
    assert run(client) == OUTPUT


def test_gemini_transport_errors_do_not_leak_credentials(client):
    client.post.side_effect = RuntimeError("private key and prompt")
    with pytest.raises(ProviderError, match="^gemini_transport_error$"):
        run(client)


def test_gemini_timeout_and_size_limits(client):
    client.post.side_effect = asyncio.TimeoutError()
    with pytest.raises(ProviderError, match="^gemini_timeout$"):
        run(client)
    client.post.side_effect = None
    client.post.return_value = SimpleNamespace(status_code=200, content=b"x" * 65537)
    with pytest.raises(ProviderError, match="^gemini_response_too_large$"):
        run(client)


def test_gemini_configuration_rejects_other_models_and_invalid_keys(client):
    for key, model in [("", MODEL), ("bad\nkey", MODEL), ("fake", "../other"), ("fake", "paid-model")]:
        with pytest.raises(ValueError):
            GeminiSummaryProvider(client, api_key=key, model=model)
    client.post.assert_not_awaited()


def test_runtime_selects_gemini_without_openai_and_separates_cache_identity(monkeypatch):
    monkeypatch.setenv("SMARTLOO_AI_PROVIDER", "gemini")
    monkeypatch.setenv("SMARTLOO_AI_MODEL", MODEL)
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-gemini-key")
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-use-openai")
    app = create_app(state={}, ai_profile=POLICY_VERSION, ai_cache=object())
    with patch("src.ai_runtime.OpenAISummaryProvider") as openai:
        with TestClient(app):
            assert isinstance(app.state.summary_service.provider, GeminiSummaryProvider)
            assert "gemini:" in app.state.summary_service.policy_version
        openai.assert_not_called()
    assert app.state.summary_service is None


def test_missing_gemini_key_does_not_fall_back_to_openai(monkeypatch):
    monkeypatch.setenv("SMARTLOO_AI_PROVIDER", "gemini")
    monkeypatch.setenv("SMARTLOO_AI_MODEL", MODEL)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-use-openai")
    app = create_app(state={}, ai_profile=POLICY_VERSION)
    with patch("src.ai_runtime.OpenAISummaryProvider") as openai:
        with TestClient(app):
            assert app.state.summary_service is None
        openai.assert_not_called()
