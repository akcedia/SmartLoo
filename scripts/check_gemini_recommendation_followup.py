"""One explicitly approved native recommendation follow-up; no automatic retry."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.check_gemini_http_acceptance import FACILITY_ID, PilotCache, private_settings


def run_probe():
    from fastapi.testclient import TestClient
    from src.app import create_app
    from src.ai_openai import ProviderError

    facility = {"id": FACILITY_ID, "name": "Synthetic follow-up facility", "status": "ACTIVE",
                "latitude": 41, "longitude": 29, "distance_m": 100,
                "is_free": True, "has_disabled_access": True, "has_baby_changing": None,
                "review_count": 0, "review_version": 0, "average_cleanliness": None}
    app = create_app(state={"toilets": {FACILITY_ID: facility}},
                     nearby_search=lambda **filters: [facility], ai_cache=PilotCache())
    report = {"requests_attempted": 0, "provider_http_statuses": []}

    async def limit(_request):
        if report["requests_attempted"] >= 1:
            raise RuntimeError("followup_request_limit")
        report["requests_attempted"] += 1

    async def status(response):
        report["provider_http_statuses"].append(response.status_code)

    with TestClient(app, raise_server_exceptions=False) as client:
        original = app.state.recommendation_reason_provider
        original.client.event_hooks["request"].append(limit)
        original.client.event_hooks["response"].append(status)

        async def diagnosed(evidence):
            try:
                return await original(evidence)
            except ProviderError as exc:
                code = str(exc)
                # Only codes produced by the adapter; never arbitrary exception text.
                if code in {"gemini_timeout", "gemini_transport_error", "gemini_http_error",
                            "gemini_invalid_output", "gemini_response_too_large", "gemini_blocked_response",
                            "gemini_invalid_candidates", "gemini_incomplete_response",
                            "gemini_invalid_message", "gemini_non_text_response"}:
                    report["provider_error_code"] = code
                raise

        app.state.recommendation_reason_provider = diagnosed
        start = perf_counter()
        response = client.get("/api/v1/recommendations", params={
            "lat": 41, "lon": 29, "is_free": "true", "has_disabled_access": "true"})
        report.update(http=response.status_code, elapsed_ms=round((perf_counter() - start) * 1000))
        data = response.json() if response.status_code == 200 else {}
        rows = data.get("results", [])
        preserved = len(rows) == 1 and rows[0].get("id") == FACILITY_ID
        report.update(candidate_preserved=preserved, count=data.get("count"), fallback=data.get("fallback"),
                      validated=preserved and data.get("ai_reasons_available") is True
                      and data.get("fallback") is False and data.get("message") is None
                      and bool(rows[0].get("reason")))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-one-extra-free-tier-request", action="store_true")
    args = parser.parse_args()
    if not args.confirm_one_extra_free_tier_request:
        raise SystemExit("Separate approval for one extra Free-tier request required; no request sent.")
    from src.ai_gemini import MODEL
    from src.ai_restricted_policy import PROFILE_NAME, POLICY_VERSION

    folder = ROOT / ".venv"
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    # Preserve earlier receipts; allow one separately approved probe per reviewed revision.
    output = folder / f"gemini-recommendation-followup-{sha}.json"
    if folder.is_symlink() or output.exists() or output.is_symlink():
        raise SystemExit("Refusing an existing/redirected receipt; no request sent.")
    settings = private_settings(folder / "gemini.env", MODEL, PROFILE_NAME)
    os.environ.update(settings)
    report = dict(commit=sha,
                  model=MODEL, policy=POLICY_VERSION, maximum_requests=1, synthetic_only=True)
    with output.open("x", encoding="utf-8") as receipt:
        try:
            report.update(run_probe())
        except Exception as exc:
            report["error_type"] = type(exc).__name__
        receipt.write(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
    return 0 if report.get("validated") and report.get("requests_attempted") == 1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
