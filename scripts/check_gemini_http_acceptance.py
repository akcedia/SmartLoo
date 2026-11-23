"""Opt-in live Gemini smoke through both public routes using in-memory fixtures."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FACILITY_ID = "00000000-0000-4000-8000-000000000001"


class PilotCache:
    """The pilot makes one summary request and does not use a shared cache."""

    async def get(self, key):
        return None

    async def put(self, key, value, ttl):
        pass


def private_settings(path, model, profile):
    try:
        pairs = [line.split("=", 1) for line in path.read_text(encoding="utf-8").splitlines()]
        settings = dict(pairs)
        expected = {"SMARTLOO_AI_PROVIDER": "gemini", "SMARTLOO_AI_MODEL": model,
                    "SMARTLOO_AI_PROFILE": profile}
        if (len(pairs) != len(settings) or set(settings) != {*expected, "GEMINI_API_KEY"}
                or any(settings[name] != value for name, value in expected.items())):
            raise ValueError()
        key = settings["GEMINI_API_KEY"]
        if not key or any(char.isspace() for char in key):
            raise ValueError()
        return settings
    except (OSError, ValueError, KeyError):
        raise SystemExit("Private Gemini settings are absent or invalid. No request was sent.") from None


def run_pilot():
    from fastapi.testclient import TestClient
    from src.app import create_app

    fixture = {"id": FACILITY_ID, "name": "Synthetic pilot facility", "status": "ACTIVE",
               "latitude": 41.0, "longitude": 29.0, "distance_m": 100,
               "is_free": True, "has_disabled_access": True, "has_baby_changing": None,
               "review_count": 3, "average_cleanliness": 5, "review_version": 1}
    reviews = {
        f"pilot-{index}": {"id": f"pilot-{index}", "toilet_id": FACILITY_ID,
                          "comment": "Temizdi.", "cleanliness_score": 5,
                          "created_at": "2026-11-23T12:00:00+00:00"}
        for index in range(1, 4)
    }
    app = create_app(state={"toilets": {FACILITY_ID: fixture}, "reviews": reviews},
                     nearby_search=lambda **filters: [fixture], ai_cache=PilotCache())
    sent = 0

    async def limit_requests(_):
        nonlocal sent
        if sent >= 2:
            raise RuntimeError("pilot_request_limit")
        sent += 1

    with TestClient(app, raise_server_exceptions=False) as client:
        app.state.summary_service.provider.client.event_hooks["request"].append(limit_requests)
        start = perf_counter()
        summary = client.get(f"/api/v1/toilets/{FACILITY_ID}/summary")
        summary_ms = round((perf_counter() - start) * 1000)
        start = perf_counter()
        reasons = client.get("/api/v1/recommendations", params={
            "lat": 41, "lon": 29, "is_free": "true", "has_disabled_access": "true",
        })
        reasons_ms = round((perf_counter() - start) * 1000)

    summary_data = summary.json() if summary.status_code == 200 else {}
    reason_data = reasons.json() if reasons.status_code == 200 else {}
    rows = reason_data.get("results", [])
    return {
        "requests_attempted": sent,
        "summary": {"http": summary.status_code, "elapsed_ms": summary_ms,
                    "validated": summary_data.get("summary") == "Temiz."
                    and summary_data.get("based_on_reviews") == 3},
        "recommendation": {"http": reasons.status_code, "elapsed_ms": reasons_ms,
                           "fallback": reason_data.get("fallback"),
                           "validated": reason_data.get("ai_reasons_available") is True
                           and reason_data.get("fallback") is False
                           and reason_data.get("message") is None and len(rows) == 1
                           and rows[0]["id"] == FACILITY_ID and bool(rows[0].get("reason"))},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-free-tier", action="store_true")
    args = parser.parse_args()
    if not args.confirm_free_tier:
        raise SystemExit("Confirm the approved Gemini Free-tier test first. No request was sent.")

    from src.ai_gemini import MODEL
    from src.ai_restricted_policy import POLICY_VERSION, PROFILE_NAME

    folder = ROOT / ".venv"
    output = folder / "gemini-http-acceptance.json"
    if folder.is_symlink() or output.exists() or output.is_symlink():
        raise SystemExit("Refusing an existing receipt or redirected output. No request was sent.")
    settings = private_settings(folder / "gemini.env", MODEL, PROFILE_NAME)
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tracked_changes = subprocess.check_output(
        ["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT, text=True).strip()
    os.environ.update(settings)
    evidence = {"commit": sha, "model": MODEL, "policy": POLICY_VERSION,
                "tracked_changes": bool(tracked_changes), "synthetic_only": True, "maximum_requests": 2}
    with output.open("x", encoding="utf-8") as receipt:
        # Reserve the receipt before calls so a second process cannot repeat the run.
        try:
            evidence.update(run_pilot())
        except Exception as exc:
            evidence["error_type"] = type(exc).__name__
        receipt.write(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, ensure_ascii=False))
    return 0 if evidence.get("requests_attempted") == 2 and all(
        evidence[name]["validated"] for name in ("summary", "recommendation")) else 1


if __name__ == "__main__":
    raise SystemExit(main())
