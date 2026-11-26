"""Actual AI consumer + contract adapter + TEST-ONLY shared-lock writer model.

Exercises the consumer's ordering. This is not a production coordinator or a
real PostgreSQL/MongoDB/Redis integration test.
"""

import asyncio
import unittest
from copy import deepcopy
from unittest.mock import AsyncMock

from src.ai_evidence import EvidencePreparer
from src.ai_review_adapter import CoordinatedReviewRepository
from src.ai_review_contract import SummaryPublication
from src.ai_summary_service import PublicationDecision, SummaryService
from tests.test_ai_consistency_contract import A, ModelCoordinator, ModelStore


class ObservedCache:
    def __init__(self, store):
        self.store = store
        self.values = {}
        self.reads = 0
        self.writes = 0
        self.write_guards = []
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self.pause = False
        self.fail = False

    async def get(self, key):
        self.reads += 1
        return deepcopy(self.values.get(key))

    async def put(self, key, value, ttl):
        self.write_guards.append(self.store.lock.locked())
        self.entered.set()
        if self.pause:
            await self.release.wait()
        if self.fail:
            raise ConnectionError("synthetic-cache-error")
        self.writes += 1
        self.values[key] = deepcopy(value)


class GuardedConsumerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = ModelStore()
        self.store.data["reviews"] = [
            {"id": f"internal-{i}", "cleanliness_score": 5, "comment": "Temiz.",
             "created_at": "2026-11-17T09:00:00Z"} for i in range(3)
        ]
        self.coordinator = ModelCoordinator(self.store)
        self.writer = ModelCoordinator(self.store)
        self.repository = CoordinatedReviewRepository(self.coordinator)
        self.cache = ObservedCache(self.store)
        self.provider = AsyncMock(return_value={"summary": "Temiz."})
        self.validator = AsyncMock(side_effect=lambda value, evidence: value)
        self.service = SummaryService(self.repository, self.cache, self.provider,
            prepare_evidence=EvidencePreparer(privacy_check=AsyncMock(return_value=True)),
            validate_output=self.validator, policy_version="guarded-consumer-fixture-v1",
            publish_current=self.repository.publish_current)

    async def test_success_writes_only_under_shared_guard(self):
        async def provider(evidence):
            self.assertFalse(self.store.lock.locked())
            return {"summary": "Temiz."}
        self.provider.side_effect = provider
        result = await self.service.summarize(A)
        self.assertEqual(result["based_on_reviews"], 3)
        self.assertEqual(self.cache.writes, 1)
        self.assertEqual(self.cache.write_guards, [True])

    async def test_cache_hit_also_uses_guard_and_does_not_rewrite(self):
        first = await self.service.summarize(A)
        second = await self.service.summarize(A)
        self.assertEqual(first, second)
        self.assertEqual(self.provider.await_count, 1)
        self.assertEqual(self.cache.writes, 1)

    async def test_edit_during_generation_rejects_actual_consumer_result(self):
        async def provider(evidence):
            await self.writer.begin()
            self.writer.finish(edit=True)
            return {"summary": "old text"}
        self.provider.side_effect = provider
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(result["review_count"], 100)
        self.assertEqual(self.cache.writes, 0)

    async def test_delete_during_generation_returns_latest_totals(self):
        async def provider(evidence):
            await self.writer.begin()
            self.writer.finish(delete=True)
            return {"summary": "old text"}
        self.provider.side_effect = provider
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(result["review_count"], 99)
        self.assertEqual(self.cache.writes, 0)

    async def test_writer_starting_during_cache_hit_validation_blocks_return(self):
        await self.service.summarize(A)
        async def validation(value, evidence):
            await self.writer.begin()
            return value
        self.validator.side_effect = validation
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(self.cache.writes, 1)
        self.assertEqual(self.provider.await_count, 1)
        self.writer.finish(edit=True)

    async def test_writer_waits_until_actual_cache_callback_finishes(self):
        self.cache.pause = True
        request = asyncio.create_task(self.service.summarize(A))
        await self.cache.entered.wait()
        writer_entered = asyncio.Event()
        async def write():
            await self.writer.begin()
            writer_entered.set()
            self.writer.finish(delete=True)
        writing = asyncio.create_task(write())
        await asyncio.sleep(0)
        self.assertFalse(writer_entered.is_set())
        self.cache.release.set()
        result = await request
        await writing
        self.assertIsNotNone(result["summary"])
        self.assertEqual(self.cache.write_guards, [True])
        # The first response linearized before the writer; the next read cannot
        # reuse its now-old key after the successful deletion/version bump.
        after = await self.service.summarize(A)
        self.assertIsNone(after["summary"])
        self.assertEqual(after["review_count"], 99)

    async def test_double_failure_during_generation_blocks_cache_and_uses_verified_stats(self):
        async def provider(evidence):
            await self.writer.begin()
            self.writer.finish(sql_error=True, undo_error=True)
            return {"summary": "unsafe"}
        self.provider.side_effect = provider
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual((result["review_count"], result["average_cleanliness"]), (100, 3.5))
        self.assertEqual(self.cache.writes, 0)

    async def test_initial_repair_state_does_not_read_cache_or_call_provider(self):
        await self.writer.begin()
        self.writer.finish(sql_error=True, undo_error=True)
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(self.cache.reads, 0)
        self.provider.assert_not_awaited()

    async def test_missing_guard_is_configuration_error(self):
        with self.assertRaisesRegex(ValueError, "guarded_publication_is_required"):
            SummaryService(self.repository, self.cache, self.provider,
                prepare_evidence=AsyncMock(), validate_output=AsyncMock(),
                policy_version="fixture", publish_current=None)

    async def test_fabricated_success_without_callback_is_rejected(self):
        async def bad_guard(toilet_id, revision, publish):
            return PublicationDecision(True, await self.repository.snapshot(A), {"summary": "fabricated"})
        self.service.publish_current = bad_guard
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(self.cache.writes, 0)

    async def test_bad_coordinator_status_cannot_expose_value(self):
        snapshot = await self.coordinator.snapshot_for_summary(A)
        self.coordinator.publish_summary_if_current = AsyncMock(
            return_value=SummaryPublication("repair_required", snapshot, {"summary": "unsafe"}))
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertEqual(self.cache.writes, 0)

    async def test_cache_error_can_skip_cache_under_guard(self):
        self.cache.fail = True
        result = await self.service.summarize(A)
        self.assertIsNotNone(result["summary"])
        self.assertEqual(self.cache.writes, 0)
        self.assertEqual(self.cache.write_guards, [True])

    async def test_cancellation_during_cache_write_releases_guard(self):
        self.cache.pause = True
        request = asyncio.create_task(self.service.summarize(A))
        await self.cache.entered.wait()
        request.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await request
        self.assertFalse(self.store.lock.locked())
        self.assertEqual(self.cache.writes, 0)

    async def test_total_deadline_cancels_guarded_cache_write(self):
        self.cache.pause = True
        self.service.timeout_seconds = 0.03
        result = await self.service.summarize(A)
        self.assertIsNone(result["summary"])
        self.assertFalse(self.store.lock.locked())
        self.assertEqual(self.cache.writes, 0)


if __name__ == "__main__":
    unittest.main()
