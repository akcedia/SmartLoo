"""First #59 slice: revision-aware orchestration, independent of HTTP/stores.

All ports are async. Production wiring MUST supply reviewed evidence preparation
and semantic validation; there is deliberately no permissive default for either.
This module alone is not a live AI pipeline or a PII sanitizer.
"""

import asyncio
import json
import logging
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

TTL_SECONDS = 6 * 60 * 60
INSUFFICIENT = "Not enough reviews to generate a summary (minimum 3)."
UNAVAILABLE = "Summary temporarily unavailable."
LOG = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReviewSnapshot:
    """Store-owned, consistent view; never substitute Redis as revision authority.

    reviews: visible eligible candidates in newest-first, stable ID order.
    Stats include rating-only reviews; evidence preparation may exclude text.
    consistent=False marks an unfinished cross-store mutation.
    """

    revision: str
    reviews: tuple
    review_count: int
    average_cleanliness: float | None
    consistent: bool = True


class ReviewRepository(Protocol):
    async def snapshot(self, toilet_id: str) -> ReviewSnapshot: ...


class SummaryCache(Protocol):
    async def get(self, key: str) -> dict | None: ...
    async def put(self, key: str, value: dict, ttl: int) -> None: ...


class RedisSummaryCache:
    """Accept a redis.asyncio-compatible client with bounded socket timeouts.

    Import/connection ownership stays in the composition root; no new package or
    environment variable is silently added to the shared dependency files.
    """

    def __init__(self, client):
        self.client = client

    async def get(self, key):
        value = await self.client.get(key)
        return None if value is None else json.loads(value)

    async def put(self, key, value, ttl):
        await self.client.set(key, json.dumps(value, ensure_ascii=False), ex=ttl)


class SummaryService:
    def __init__(self, repository, cache, provider, *, prepare_evidence,
                 validate_output, policy_version, timeout_seconds=10):
        if not policy_version or not 0 < timeout_seconds <= 10:
            raise ValueError("A policy version and a budget of at most 10s are required")
        self.repository = repository
        self.cache = cache
        self.provider = provider
        self.prepare_evidence = prepare_evidence
        self.validate_output = validate_output
        self.policy_version = policy_version
        self.timeout_seconds = timeout_seconds

    def cache_key(self, toilet_id, revision):
        # JSON encodes components unambiguously; policy covers prompt/model,
        # sanitizer, schema and eligibility rules. Invalidation is logical.
        return "smartloo:summary:" + json.dumps(
            [toilet_id, revision, "tr", self.policy_version], separators=(",", ":")
        )

    async def summarize(self, toilet_id):
        latest = None
        correlation_id = str(uuid4())

        def fallback(message=UNAVAILABLE):
            return {"summary": None, "message": message,
                    "review_count": latest.review_count,
                    "average_cleanliness": latest.average_cleanliness}

        async def current():
            nonlocal latest
            latest = await self.repository.snapshot(toilet_id)
            if not latest.consistent:
                raise ValueError("snapshot_not_consistent")
            return latest

        async def pipeline():
            first = await current()
            revision = first.revision
            # Preparation handles PII and ordering BEFORE limiting to 50.
            evidence = (await self.prepare_evidence(first))[:50]
            if len(evidence) < 3:
                return fallback(INSUFFICIENT)
            key = self.cache_key(toilet_id, revision)
            cached = None
            try:
                cached = await self.cache.get(key)
            except Exception:
                LOG.warning("ai_cache_read_failed correlation_id=%s", correlation_id)
            if cached is not None:
                try:
                    candidate = deepcopy(cached)
                    generated_at = candidate.pop("generated_at")
                    count = candidate.pop("based_on_reviews")
                    if count != len(evidence):
                        raise ValueError("cache_evidence_mismatch")
                    validated = await self.validate_output(candidate, evidence)
                except Exception:
                    LOG.warning("ai_cache_rejected correlation_id=%s", correlation_id)
                else:
                    if (await current()).revision != revision:
                        return fallback()
                    return {**validated, "based_on_reviews": count,
                            "generated_at": generated_at}

            candidate = await self.provider(deepcopy(evidence))
            validated = await self.validate_output(candidate, evidence)
            result = {**validated, "based_on_reviews": len(evidence),
                      "generated_at": datetime.now(timezone.utc).isoformat()}
            if (await current()).revision != revision:
                return fallback()
            try:
                await self.cache.put(key, deepcopy(result), TTL_SECONDS)
            except Exception:
                LOG.warning("ai_cache_write_failed correlation_id=%s", correlation_id)
            # Recheck after cache I/O, including the cache-hit path above.
            if (await current()).revision != revision:
                return fallback()
            return result

        try:
            # Covers repository, cache, evidence preparation, provider and checks.
            return await asyncio.wait_for(pipeline(), timeout=self.timeout_seconds)
        except Exception as exc:
            LOG.warning("ai_summary_failed correlation_id=%s error_type=%s",
                        correlation_id, type(exc).__name__)
            if latest is None:
                # Route owner must distinguish missing facility (404) from store
                # failure (503); no invented statistics or success response.
                raise
            return fallback()
