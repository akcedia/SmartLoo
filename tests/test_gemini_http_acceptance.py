import json

import httpx
import pytest

from scripts import check_gemini_http_acceptance as pilot
from src.ai_gemini import MODEL
from src.ai_restricted_policy import PROFILE_NAME, expected_candidate


@pytest.mark.parametrize("supported_reason", [True, False])
def test_pilot_runs_both_routes_and_reports_only_validation(monkeypatch, supported_reason):
    posted = []

    async def respond(request):
        payload = json.loads(request.content)
        data = json.loads(payload["contents"][0]["parts"][0]["text"])
        posted.append(data)
        if "reviews" in data:
            result = expected_candidate(data["reviews"])
        else:
            result = {"recommendations": [{
                "candidate_ref": "c1", "claims": ["free", "accessible"],
                "reason": "Tesis ücretsiz ve engelli erişimine uygun." if supported_reason else "Tesis güvenlidir.",
            }]}
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP",
            "content": {"role": "model", "parts": [{"text": json.dumps(result)}]}}]})

    async_client = httpx.AsyncClient
    monkeypatch.setattr("src.ai_runtime.httpx.AsyncClient",
                        lambda: async_client(transport=httpx.MockTransport(respond)))
    monkeypatch.setenv("SMARTLOO_AI_PROVIDER", "gemini")
    monkeypatch.setenv("SMARTLOO_AI_MODEL", MODEL)
    monkeypatch.setenv("SMARTLOO_AI_PROFILE", PROFILE_NAME)
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-test-key")

    evidence = pilot.run_pilot()

    assert evidence["requests_attempted"] == len(posted) == 2
    assert posted[0]["reviews"] == [
        {"request_review_ref": f"r{index}", "text": "Temizdi."} for index in range(1, 4)
    ]
    assert posted[1] == {"candidates": [{"candidate_ref": "c1", "allowed_claims": ["free", "accessible"]}]}
    assert evidence["summary"]["validated"] is True
    assert evidence["recommendation"]["validated"] is supported_reason
    assert evidence["recommendation"]["fallback"] is not supported_reason
    assert "Temiz" not in json.dumps(evidence)
    assert "synthetic-test-key" not in json.dumps(evidence)


@pytest.mark.parametrize("existing_receipt", [False, True])
def test_pilot_refuses_before_any_model_call_without_private_setup(tmp_path, monkeypatch, existing_receipt):
    folder = tmp_path / ".venv"
    folder.mkdir()
    receipt = folder / "gemini-http-acceptance.json"
    if existing_receipt:
        receipt.write_text("existing receipt")
    monkeypatch.setattr(pilot, "ROOT", tmp_path)
    monkeypatch.setattr("sys.argv", ["pilot", "--confirm-free-tier"])
    monkeypatch.setattr(pilot, "run_pilot", lambda: pytest.fail("The model must not be called"))
    with pytest.raises(SystemExit, match="No request was sent"):
        pilot.main()
    if existing_receipt:
        assert receipt.read_text() == "existing receipt"
    else:
        assert not receipt.exists()
