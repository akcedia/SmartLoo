"""Follow-up diagnostics without external calls or shared data."""
import json
import httpx
import pytest
from scripts import check_gemini_recommendation_followup as probe
from src.ai_gemini import MODEL
from src.ai_restricted_policy import PROFILE_NAME


@pytest.mark.parametrize("failure", [None, "timeout", "quota"])
def test_followup_is_one_request_with_only_redacted_diagnostics(monkeypatch, failure):
    posted = []

    async def respond(request):
        posted.append(json.loads(request.content))
        if failure == "timeout":
            raise httpx.ReadTimeout("sensitive raw diagnostic", request=request)
        if failure == "quota":
            return httpx.Response(429, json={"error": "sensitive raw diagnostic"})
        output = {"recommendations": [{"candidate_ref": "c1", "claims": ["free", "accessible"],
                    "reason": "Tesis ücretsiz ve engelli erişimine uygun."}]}
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "role": "model", "parts": [{"text": json.dumps(output)}]}}]})

    async_client = httpx.AsyncClient
    monkeypatch.setattr("src.ai_runtime.httpx.AsyncClient", lambda: async_client(transport=httpx.MockTransport(respond)))
    for name, value in {"SMARTLOO_AI_PROVIDER": "gemini", "SMARTLOO_AI_MODEL": MODEL,
                        "SMARTLOO_AI_PROFILE": PROFILE_NAME, "GEMINI_API_KEY": "synthetic-test-key"}.items():
        monkeypatch.setenv(name, value)
    result = probe.run_probe()
    assert result["requests_attempted"] == len(posted) == 1
    assert result["candidate_preserved"] and result["count"] == 1
    assert result["validated"] is (failure is None)
    assert result["fallback"] is (failure is not None)
    assert result["provider_http_statuses"] == ([] if failure == "timeout" else [429 if failure == "quota" else 200])
    if failure:
        assert result["provider_error_code"] == ("gemini_transport_error" if failure == "timeout" else "gemini_http_error")
    encoded = json.dumps(result)
    assert "synthetic-test-key" not in encoded and "sensitive raw diagnostic" not in encoded and "Tesis" not in encoded


def test_followup_requires_separate_explicit_approval(monkeypatch):
    monkeypatch.setattr("sys.argv", ["probe"])
    monkeypatch.setattr(probe, "run_probe", lambda: pytest.fail("No request is authorized"))
    with pytest.raises(SystemExit, match="Separate approval"):
        probe.main()


def test_followup_never_overwrites_or_repeats_a_completed_revision(tmp_path, monkeypatch):
    folder = tmp_path / ".venv"
    folder.mkdir()
    sha = "a" * 40
    receipt = folder / f"gemini-recommendation-followup-{sha}.json"
    receipt.write_text("original receipt")
    monkeypatch.setattr(probe, "ROOT", tmp_path)
    monkeypatch.setattr(probe.subprocess, "check_output", lambda *args, **kwargs: sha)
    monkeypatch.setattr("sys.argv", ["probe", "--confirm-one-extra-free-tier-request"])
    monkeypatch.setattr(probe, "run_probe", lambda: pytest.fail("Completed revision must not repeat"))
    with pytest.raises(SystemExit, match="Refusing"):
        probe.main()
    assert receipt.read_text() == "original receipt"
