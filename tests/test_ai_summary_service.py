"""Orchestration tests with synthetic ports, NOT TC/HTTP/live-model acceptance."""

import asyncio
import unittest
from copy import deepcopy
from dataclasses import replace
from unittest.mock import AsyncMock
from tests.ai_test_ports import sequential_publication

from src.ai_summary_service import (
    INSUFFICIENT, TTL_SECONDS, RedisSummaryCache, ReviewSnapshot, SummaryService,
)


class Cache:
    def __init__(self):
        self.values = {}
        self.now = 0
        self.writes = 0

    async def get(self, key):
        value, expires = self.values.get(key, (None, 0))
        return deepcopy(value) if self.now < expires else None

    async def put(self, key, value, ttl):
        self.values[key] = (deepcopy(value), self.now + ttl)
        self.writes += 1


class SummaryServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.snapshot = ReviewSnapshot("1", ("temiz", "sabun yok", "temiz"), 3, 4.0)
        self.repo = AsyncMock()
        self.repo.snapshot.side_effect = lambda _: self.snapshot
        self.cache = Cache()
        self.provider = AsyncMock(return_value={"summary": "Temiz, ancak sabun eksik."})
        # These are deliberately synthetic acceptance gates. Production must
        # supply PII/language/schema/grounding checks; no such claim is made here.
        self.prepare = AsyncMock(side_effect=lambda s: list(s.reviews))
        self.validator = AsyncMock(side_effect=lambda value, evidence: value)
        self.service = SummaryService(
            self.repo, self.cache, self.provider, prepare_evidence=self.prepare,
            validate_output=self.validator, policy_version="test-only-v1",
            publish_current=sequential_publication(self.repo.snapshot),
        )

    async def test_M01_M04_success_and_second_read_uses_cache(self):
        first = await self.service.summarize("A")
        second = await self.service.summarize("A")
        self.assertEqual(first, second)
        self.assertEqual(first["based_on_reviews"], 3)
        self.assertEqual(self.provider.await_count, 1)
        self.assertEqual(self.cache.writes, 1)

    async def test_M02_M17_zero_or_two_reviews_never_calls_provider(self):
        for count in (0, 2):
            self.snapshot = replace(self.snapshot, reviews=("temiz",) * count,
                                    review_count=count, average_cleanliness=4.0 if count else None)
            result = await self.service.summarize("A")
            self.assertIsNone(result["summary"])
            self.assertEqual(result["message"], INSUFFICIENT)
            self.assertEqual(result["review_count"], count)
        self.provider.assert_not_awaited()
        self.assertEqual(self.cache.writes, 0)

    async def test_M03_limit_after_preparation(self):
        self.snapshot = replace(self.snapshot, reviews=tuple(str(i) for i in range(51)), review_count=51)
        result = await self.service.summarize("A")
        self.assertEqual(result["based_on_reviews"], 50)
        self.assertEqual(self.provider.call_args.args[0], list(self.snapshot.reviews[:50]))

    async def test_M05_M16_revision_change_regenerates(self):
        await self.service.summarize("A")
        self.snapshot = replace(self.snapshot, revision="2")
        await self.service.summarize("A")
        self.assertEqual(self.provider.await_count, 2)

    async def test_M06_delete_below_threshold_does_not_serve_cached_summary(self):
        await self.service.summarize("A")
        self.snapshot = replace(self.snapshot, revision="2", reviews=("temiz",) * 2, review_count=2)
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        self.assertEqual(result["review_count"], 2)
        self.assertEqual(self.provider.await_count, 1)

    async def test_M07_immediate_provider_timeout_falls_back_without_cache(self):
        self.provider.side_effect = TimeoutError("private-provider-text")
        with self.assertLogs("src.ai_summary_service", level="WARNING") as logs:
            result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        self.assertEqual(result["average_cleanliness"], 4.0)
        self.assertEqual(self.cache.writes, 0)
        self.assertNotIn("private-provider-text", " ".join(logs.output))
        self.assertIn("correlation_id=", " ".join(logs.output))

    async def test_actual_timer_cancels_waiting_provider(self):
        cancelled = asyncio.Event()
        async def delayed(_):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.set()
        self.provider.side_effect = delayed
        loop = asyncio.get_running_loop()
        start = loop.time()
        result = await self.service.summarize("A")
        elapsed = loop.time() - start
        self.assertIsNone(result["summary"])
        self.assertTrue(cancelled.is_set())
        self.assertGreaterEqual(elapsed, 9.9)
        self.assertLess(elapsed, 11.5)

    async def test_M08_M10_validator_rejection_cannot_publish_or_cache(self):
        self.validator.side_effect = ValueError("untrusted-output")
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        self.assertEqual(self.cache.writes, 0)

    async def test_M11_revision_changes_during_provider(self):
        async def race(_):
            self.snapshot = replace(self.snapshot, revision="2", review_count=4)
            return {"summary": "stale"}
        self.provider.side_effect = race
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        self.assertEqual(result["review_count"], 4)
        self.assertEqual(self.cache.writes, 0)

    async def test_M12_redis_failure_still_allows_valid_generation(self):
        self.service.cache = AsyncMock()
        self.service.cache.get.side_effect = ConnectionError()
        self.service.cache.put.side_effect = ConnectionError()
        result = await self.service.summarize("A")
        self.assertEqual(result["based_on_reviews"], 3)

    async def test_M14_six_hour_expiry_regenerates(self):
        await self.service.summarize("A")
        self.cache.now += TTL_SECONDS
        await self.service.summarize("A")
        self.assertEqual(self.provider.await_count, 2)

    async def test_revision_changes_during_cache_write(self):
        original = self.cache.put
        async def race(*args):
            await original(*args)
            self.snapshot = replace(self.snapshot, revision="2")
        self.cache.put = race
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        # Old-key data is unreachable to subsequent revision-2 readers.
        await self.service.summarize("A")
        self.assertEqual(self.provider.await_count, 2)

    async def test_revision_changes_during_cache_hit_validation(self):
        await self.service.summarize("A")
        async def race(value, evidence):
            self.snapshot = replace(self.snapshot, revision="2")
            return value
        self.validator.side_effect = race
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])

    async def test_corrupt_cache_is_miss_not_user_visible_error(self):
        self.cache.get = AsyncMock(return_value={"summary": "corrupt"})
        result = await self.service.summarize("A")
        self.assertEqual(result["based_on_reviews"], 3)
        self.assertEqual(self.provider.await_count, 1)

    async def test_M18_inconsistent_snapshot_never_serves_cached_summary(self):
        await self.service.summarize("A")
        self.snapshot = replace(self.snapshot, consistent=False)
        result = await self.service.summarize("A")
        self.assertIsNone(result["summary"])
        self.assertEqual(self.provider.await_count, 1)

    async def test_unknown_repository_state_is_not_fabricated_as_zero(self):
        self.repo.snapshot.side_effect = ConnectionError()
        with self.assertRaises(ConnectionError):
            await self.service.summarize("A")
        self.provider.assert_not_awaited()

    async def test_redis_adapter_json_and_expiry_contract(self):
        client = AsyncMock()
        adapter = RedisSummaryCache(client)
        await adapter.put("key", {"summary": "Türkçe"}, TTL_SECONDS)
        args, kwargs = client.set.call_args
        self.assertEqual(kwargs["ex"], 21600)
        client.get.return_value = args[1].encode()
        self.assertEqual(await adapter.get("key"), {"summary": "Türkçe"})


if __name__ == "__main__":
    unittest.main()
