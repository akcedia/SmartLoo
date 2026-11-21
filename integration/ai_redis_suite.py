"""Real Redis component checks; no live OpenAI or PostgreSQL/Mongo coordinator.

Run via integration.run_ai_redis_checks with an explicitly supplied isolated
SMARTLOO_AI_TEST_REDIS_URL. No skip or fake Redis fallback is allowed.
"""

import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock
from uuid import uuid4

from src.ai_evidence import EvidencePreparer
from src.ai_review_adapter import CoordinatedReviewRepository
from src.ai_summary_service import RedisSummaryCache, SummaryService, TTL_SECONDS
from tests.test_ai_consistency_contract import ModelCoordinator, ModelStore

SERVER_VERSION = None


class RecordingClient:
    """Forward every cache operation to the real async client; track own keys."""

    def __init__(self, client):
        self.client = client
        self.keys = set()

    async def get(self, key):
        return await self.client.get(key)

    async def set(self, key, value, *, ex):
        self.keys.add(key)
        return await self.client.set(key, value, ex=ex)


class RedisIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        global SERVER_VERSION
        url = os.environ.get("SMARTLOO_AI_TEST_REDIS_URL")
        if not url:
            raise RuntimeError("Explicit isolated test Redis URL is required; this is not a skipped test")
        import redis.asyncio as redis
        from redis.backoff import NoBackoff
        from redis.asyncio.retry import Retry

        self.redis_module = redis
        self.connection_options = dict(protocol=2, decode_responses=False,
            socket_connect_timeout=0.5, socket_timeout=0.5,
            retry=Retry(NoBackoff(), 0))
        self.client = redis.Redis.from_url(url, **self.connection_options)
        self.addAsyncCleanup(self.client.aclose)
        self.assertTrue(await self.client.ping())
        SERVER_VERSION = (await self.client.info("server"))["redis_version"]
        self.recording = RecordingClient(self.client)
        self.cache = RedisSummaryCache(self.recording)
        self.addAsyncCleanup(self._delete_own_keys)
        self.id = str(uuid4())

        self.store = ModelStore()
        self.store.data["toilet_id"] = self.id
        self.store.data["reviews"] = [
            {"id": f"local-{i}", "cleanliness_score": 4, "comment": "Temiz.",
             "created_at": "2026-11-18T09:00:00Z"} for i in range(3)
        ]
        self.coordinator = ModelCoordinator(self.store)
        self.repository = CoordinatedReviewRepository(self.coordinator)
        self.provider = AsyncMock(return_value={"summary": "Temiz."})
        self.service = SummaryService(self.repository, self.cache, self.provider,
            prepare_evidence=EvidencePreparer(privacy_check=AsyncMock(return_value=True)),
            validate_output=AsyncMock(side_effect=lambda value, evidence: value),
            policy_version="isolated-real-redis-v1", publish_current=self.repository.publish_current)

    async def _delete_own_keys(self):
        # No FLUSHDB/FLUSHALL or wildcard deletion. Never delete others' keys.
        if self.recording.keys:
            await self.client.delete(*self.recording.keys)

    async def _wait_until_expired(self, key):
        deadline = asyncio.get_running_loop().time() + 5
        while await self.client.exists(key):
            if asyncio.get_running_loop().time() >= deadline:
                self.fail("Redis did not expire the deliberately shortened key")
            await asyncio.sleep(0.05)

    async def test_unicode_roundtrip_and_six_hour_server_ttl(self):
        key = "smartloo:ai-integration:" + self.id
        value = {"summary": "Üsküdar: temiz, ancak sabun eksik."}
        await self.cache.put(key, value, TTL_SECONDS)
        self.assertEqual(await self.cache.get(key), value)
        raw = await self.client.get(key)
        self.assertIsInstance(raw, bytes)
        self.assertIn("Üsküdar", raw.decode("utf-8"))
        ttl = await self.client.ttl(key)
        self.assertGreater(ttl, TTL_SECONDS - 20)
        self.assertLessEqual(ttl, TTL_SECONDS)

    async def test_actual_short_key_expiry_returns_miss(self):
        key = "smartloo:ai-integration:" + self.id
        await self.cache.put(key, {"summary": "Temiz."}, 1)
        await self._wait_until_expired(key)
        self.assertIsNone(await self.cache.get(key))

    async def test_second_service_read_uses_real_cache_without_provider(self):
        first = await self.service.summarize(self.id)
        second = await self.service.summarize(self.id)
        self.assertEqual(first, second)
        self.assertEqual(self.provider.await_count, 1)
        key = self.service.cache_key(self.id, "1")
        self.assertIsNotNone(await self.client.get(key))
        self.assertGreater(await self.client.ttl(key), TTL_SECONDS - 20)

    async def test_revision_change_uses_new_key_and_never_reuses_old_summary(self):
        await self.service.summarize(self.id)
        await self.coordinator.begin()
        self.coordinator.finish(edit=True)
        await self.service.summarize(self.id)
        self.assertEqual(self.provider.await_count, 2)
        # Old data may expire naturally; correctness comes from source revision.
        for version in ("1", "2"):
            self.assertIsNotNone(await self.client.get(self.service.cache_key(self.id, version)))

    async def test_corrupt_real_cache_entry_is_replaced_by_valid_generation(self):
        key = self.service.cache_key(self.id, "1")
        self.recording.keys.add(key)
        await self.client.set(key, "{malformed", ex=30)
        result = await self.service.summarize(self.id)
        self.assertIsNotNone(result["summary"])
        self.assertEqual(self.provider.await_count, 1)
        self.assertEqual(json.loads(await self.client.get(key))["summary"], "Temiz.")

    async def test_repair_state_blocks_existing_real_cache_entry(self):
        await self.service.summarize(self.id)
        key = self.service.cache_key(self.id, "1")
        before = await self.client.get(key)
        await self.coordinator.begin()
        self.coordinator.finish(sql_error=True, undo_error=True)
        result = await self.service.summarize(self.id)
        self.assertIsNone(result["summary"])
        self.assertEqual((result["review_count"], result["average_cleanliness"]), (100, 3.5))
        self.assertEqual(self.provider.await_count, 1)
        self.assertEqual(await self.client.get(key), before)

    async def test_real_client_connection_failure_preserves_valid_generation(self):
        # Reserve then close a loopback endpoint: deterministic real TCP failure,
        # not a shutdown/restart claim for the healthy Redis service above.
        server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        server.close()
        await server.wait_closed()
        unavailable = self.redis_module.Redis(host="127.0.0.1", port=port, **self.connection_options)
        self.addAsyncCleanup(unavailable.aclose)
        self.service.cache = RedisSummaryCache(unavailable)
        result = await self.service.summarize(self.id)
        self.assertIsNotNone(result["summary"])
        self.assertEqual(self.provider.await_count, 1)
        self.assertEqual(self.recording.keys, set())

    async def test_real_expiry_causes_service_regeneration(self):
        await self.service.summarize(self.id)
        key = self.service.cache_key(self.id, "1")
        # Shorten only this test's key; do not pretend to wait six hours.
        self.assertTrue(await self.client.expire(key, 1))
        await self._wait_until_expired(key)
        await self.service.summarize(self.id)
        self.assertEqual(self.provider.await_count, 2)
        self.assertGreater(await self.client.ttl(key), TTL_SECONDS - 20)
