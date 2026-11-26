"""Run explicit real-Redis suite; missing setup, skips or count drift fail."""

import importlib.metadata
import json
import os
from pathlib import Path
import platform
import sys
import time
import unittest


def main():
    started = time.monotonic()
    suite = unittest.defaultTestLoader.loadTestsFromName("integration.ai_redis_suite")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    passed = result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)
    success = result.wasSuccessful() and result.testsRun == 8 and not result.skipped
    try:
        client_version = importlib.metadata.version("redis")
    except importlib.metadata.PackageNotFoundError:
        client_version = None
    module = sys.modules.get("integration.ai_redis_suite")
    report = {"suite": "ai-real-redis", "commit": os.environ.get("GITHUB_SHA"),
        "run_id": os.environ.get("GITHUB_RUN_ID"), "python": platform.python_version(),
        "redis_py": client_version, "redis_server": getattr(module, "SERVER_VERSION", None),
        "expected": 8, "tests": result.testsRun, "passed": passed,
        "failures": len(result.failures), "errors": len(result.errors), "skipped": len(result.skipped),
        "seconds": round(time.monotonic() - started, 3), "success": success,
        "scope": "real Redis; synthetic provider and in-memory review coordinator; no live OpenAI/DB acceptance"}
    path = Path(os.environ.get("SMARTLOO_AI_RESULTS_PATH", "output/ai-redis-integration.json"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
