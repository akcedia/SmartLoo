"""Offline, synthetic #59 demonstration. Run: python3 -m examples.ai_summary_demo.

No OpenAI/Redis/MongoDB connection. Policy approvals below apply ONLY to these
audited fixture strings/output. Never reuse them as general production policies.
"""

import asyncio
import json
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
from time import monotonic

from src.ai_evidence import EvidencePreparer, ReviewText
from src.ai_output import CATEGORIES, SummaryOutputValidator
from src.ai_summary_service import PublicationDecision, ReviewSnapshot, SummaryService

REVIEW_TEXTS = ("Temiz.", "Sabun eksik.", "Temiz, ancak sabun eksik.")
OUTPUT = {"summary": REVIEW_TEXTS[2], "pros": [REVIEW_TEXTS[0]],
          "cons": [REVIEW_TEXTS[1]], "recommendation": "acceptable",
          "categories": {name: "unknown" for name in CATEGORIES}}
OUTPUT["categories"].update(cleanliness="positive", supplies="negative")


class SyntheticRepository:
    def __init__(self):
        now = datetime(2026, 11, 17, 9, tzinfo=timezone.utc)
        self.current = ReviewSnapshot("1", tuple(
            ReviewText(str(i), now, text, ()) for i, text in enumerate(REVIEW_TEXTS)
        ), 3, 4.0)

    async def snapshot(self, toilet_id):
        if toilet_id != "synthetic-A":
            raise LookupError("synthetic_facility_not_found")
        return self.current

    async def publish_current(self, toilet_id, revision, publish):
        # This demo mutates records only BETWEEN requests. This simple fixture
        # is not a production writer/reader guard or concurrency demonstration.
        snapshot = await self.snapshot(toilet_id)
        if not snapshot.consistent or snapshot.revision != revision:
            return PublicationDecision(False, snapshot)
        return PublicationDecision(True, snapshot, await publish())


class SyntheticCache:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        value, expires = self.values.get(key, (None, 0))
        return deepcopy(value) if monotonic() < expires else None

    async def put(self, key, value, ttl):
        self.values[key] = (deepcopy(value), monotonic() + ttl)


async def main():
    repository = SyntheticRepository()
    calls = 0

    async def approve_fixture_text(text):
        return text in REVIEW_TEXTS

    async def approve_fixture_output(output, evidence):
        return output == OUTPUT and sorted(r["text"] for r in evidence) == sorted(REVIEW_TEXTS)

    async def synthetic_provider(evidence):
        nonlocal calls
        calls += 1
        return deepcopy(OUTPUT)

    validator = SummaryOutputValidator(language_check=approve_fixture_text,
        privacy_check=approve_fixture_text, grounding_check=approve_fixture_output)
    service = SummaryService(repository, SyntheticCache(), synthetic_provider,
        prepare_evidence=EvidencePreparer(privacy_check=approve_fixture_text),
        validate_output=validator, policy_version="audited-synthetic-demo-v1",
        publish_current=repository.publish_current)
    first = await service.summarize("synthetic-A")
    second = await service.summarize("synthetic-A")
    cached_calls = calls
    # A deletion changes revision and leaves fewer than three eligible reviews.
    repository.current = replace(repository.current, revision="2",
        reviews=repository.current.reviews[:2], review_count=2)
    after_delete = await service.summarize("synthetic-A")
    assert first == second and cached_calls == 1
    assert after_delete["summary"] is None and calls == 1
    print(json.dumps({"mode": "synthetic_offline_demo",
        "first_summary": first, "calls_after_two_reads": cached_calls,
        "after_review_deletion": after_delete,
        "calls_after_deletion": calls}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
