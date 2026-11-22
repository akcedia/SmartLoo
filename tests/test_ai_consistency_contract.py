"""Executable contract examples. The coordinator below is TEST-ONLY, in memory.

No PostgreSQL/MongoDB locking, crash durability or upstream CRUD acceptance is
proved. Events make interleavings explicit instead of relying on random sleeps.
"""

import asyncio
import unittest
from copy import deepcopy
from unittest.mock import AsyncMock

from src.ai_review_adapter import adapt_summary_snapshot
from src.ai_review_contract import SummaryPublication, parse_summary_snapshot

A = "00000000-0000-4000-8000-000000000028"


def envelope(**changes):
    value = {"protocol_version": 1, "toilet_id": A, "state": "ready", "review_version": 1,
             "operation_id": None, "review_count": 100, "average_cleanliness": 3.5,
             "reviews": [{"id": "r-local", "cleanliness_score": 5,
                          "comment": "Temiz.", "created_at": "2026-11-17T09:00:00Z"}]}
    return {**value, **changes}


class ModelStore:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.data = envelope()
        self.before = None


class ModelCoordinator:
    """One shared lock and a marker retained across wrapper recreation only."""

    def __init__(self, store):
        self.store = store

    async def snapshot_for_summary(self, toilet_id=A, *, limit=50):
        data = deepcopy(self.store.data)
        if self.store.lock.locked() and data["state"] == "ready":
            data.update(state="busy", reviews=[])
        return parse_summary_snapshot(data, expected_toilet_id=toilet_id)

    async def begin(self):
        await self.store.lock.acquire()
        if self.store.data["state"] != "ready":
            self.store.lock.release()
            raise RuntimeError("repair_before_new_write")
        self.store.before = deepcopy(self.store.data)
        self.store.data.update(state="writing", operation_id="synthetic-op-1", reviews=[])

    def finish(self, *, edit=False, delete=False, sql_error=False, undo_error=False):
        old = self.store.before
        if sql_error:
            if undo_error:
                self.store.data.update(state="repair_required", reviews=[])
            else:
                self.store.data = deepcopy(old)
        else:
            self.store.data = {**deepcopy(old), "review_version": old["review_version"] + 1}
            if edit:
                self.store.data["reviews"][0]["comment"] = "Yeni yorum."
            if delete:
                self.store.data.update(reviews=[], review_count=99)
        self.store.lock.release()

    def simulate_crash_after_marker(self):
        # Simulates a lost session with marker still visible, not a real crash.
        self.store.lock.release()

    async def repair(self, *, verified):
        async with self.store.lock:
            if self.store.data["state"] == "ready":
                return  # a duplicate recovery does not bump again
            if not verified:
                raise RuntimeError("repair_not_verified")
            self.store.data = {**deepcopy(self.store.before),
                               "review_version": self.store.before["review_version"] + 1}

    async def publish_summary_if_current(self, toilet_id, expected_version, publish):
        if self.store.lock.locked():
            return SummaryPublication("busy", await self.snapshot_for_summary(toilet_id))
        async with self.store.lock:
            snapshot = parse_summary_snapshot(self.store.data, expected_toilet_id=toilet_id)
            if snapshot.state != "ready":
                return SummaryPublication("repair_required", snapshot)
            if snapshot.review_version != expected_version:
                return SummaryPublication("stale", snapshot)
            value = await publish()
            return SummaryPublication("published", snapshot, value)


class SnapshotTests(unittest.TestCase):
    def test_actual_totals_are_not_derived_from_selected_text(self):
        result = adapt_summary_snapshot(envelope(), expected_toilet_id=A)
        self.assertEqual(result.review_count, 100)
        self.assertEqual(result.average_cleanliness, 3.5)
        self.assertEqual(len(result.reviews), 1)
        self.assertTrue(result.consistent)

    def test_dirty_states_do_not_claim_consistency(self):
        for state in ("busy", "writing", "repair_required"):
            payload = envelope(state=state, operation_id="op" if state != "busy" else None, reviews=[])
            result = adapt_summary_snapshot(payload, expected_toilet_id=A)
            self.assertFalse(result.consistent)
            self.assertEqual(result.reviews, ())
            self.assertEqual(result.review_count, 100)

    def test_wrong_facility_protocol_state_or_operation_rejected(self):
        for changes in ({"toilet_id": "00000000-0000-4000-8000-000000000029"},
                        {"protocol_version": True}, {"protocol_version": 2},
                        {"state": "maybe"}, {"operation_id": "unfinished"},
                        {"state": "repair_required", "operation_id": None, "reviews": []}):
            with self.assertRaises(ValueError):
                parse_summary_snapshot(envelope(**changes), expected_toilet_id=A)

    def test_dirty_snapshot_cannot_expose_partial_text(self):
        with self.assertRaises(ValueError):
            parse_summary_snapshot(envelope(state="writing", operation_id="op"), expected_toilet_id=A)

    def test_invalid_or_unknown_statistics_are_not_zero_filled(self):
        for changes in ({"review_count": None}, {"average_cleanliness": None},
                        {"average_cleanliness": float("nan")}, {"review_version": -1}):
            with self.assertRaises(ValueError):
                parse_summary_snapshot(envelope(**changes), expected_toilet_id=A)

    def test_empty_facility_preserves_null_average(self):
        result = adapt_summary_snapshot(envelope(review_count=0, average_cleanliness=None, reviews=[]), expected_toilet_id=A)
        self.assertEqual(result.review_count, 0)
        self.assertIsNone(result.average_cleanliness)


class InterleavingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = ModelStore()
        self.writer = ModelCoordinator(self.store)
        self.reader = ModelCoordinator(self.store)
        self.publish = AsyncMock(return_value={"summary": "Temiz."})

    async def test_write_in_progress_rejects_read_and_publication(self):
        await self.writer.begin()
        snapshot = await self.reader.snapshot_for_summary()
        result = await self.reader.publish_summary_if_current(A, 1, self.publish)
        self.assertFalse(snapshot.ready)
        self.assertEqual(snapshot.reviews, ())
        self.assertEqual(result.status, "busy")
        self.publish.assert_not_awaited()
        self.writer.finish()

    async def test_edit_during_generation_invalidates_old_result(self):
        initial = await self.reader.snapshot_for_summary()
        await self.writer.begin()
        self.writer.finish(edit=True)
        result = await self.reader.publish_summary_if_current(A, initial.review_version, self.publish)
        self.assertEqual(result.status, "stale")
        self.assertEqual(result.snapshot.review_version, 2)
        self.publish.assert_not_awaited()

    async def test_delete_during_generation_invalidates_old_result(self):
        await self.writer.begin()
        self.writer.finish(delete=True)
        result = await self.reader.publish_summary_if_current(A, 1, self.publish)
        self.assertEqual(result.status, "stale")
        self.assertEqual(result.snapshot.review_count, 99)
        self.publish.assert_not_awaited()

    async def test_double_failure_blocks_after_coordinator_recreation(self):
        await self.writer.begin()
        self.writer.finish(sql_error=True, undo_error=True)
        reader = ModelCoordinator(self.store)
        result = await reader.publish_summary_if_current(A, 1, self.publish)
        self.assertEqual(result.status, "repair_required")
        self.assertEqual(result.snapshot.reviews, ())
        self.publish.assert_not_awaited()

    async def test_session_loss_does_not_erase_pending_marker(self):
        await self.writer.begin()
        self.writer.simulate_crash_after_marker()
        reader = ModelCoordinator(self.store)
        self.assertFalse((await reader.snapshot_for_summary()).ready)
        result = await reader.publish_summary_if_current(A, 1, self.publish)
        self.assertEqual(result.status, "repair_required")

    async def test_verified_repair_bumps_revision_once(self):
        await self.writer.begin()
        self.writer.finish(sql_error=True, undo_error=True)
        with self.assertRaises(RuntimeError):
            await self.writer.repair(verified=False)
        self.assertFalse((await self.reader.snapshot_for_summary()).ready)
        await self.writer.repair(verified=True)
        await self.writer.repair(verified=True)
        result = await self.reader.publish_summary_if_current(A, 1, self.publish)
        self.assertEqual(result.status, "stale")
        self.assertEqual(result.snapshot.review_version, 2)

    async def test_writer_cannot_enter_between_publication_check_and_cache_write(self):
        entered, release, writer_entered = asyncio.Event(), asyncio.Event(), asyncio.Event()
        async def callback():
            entered.set()
            await release.wait()
            self.assertFalse(writer_entered.is_set())
            return {"summary": "Temiz."}
        async def write():
            await self.writer.begin()
            writer_entered.set()
            self.writer.finish(edit=True)
        publication = asyncio.create_task(self.reader.publish_summary_if_current(A, 1, callback))
        await entered.wait()
        writing = asyncio.create_task(write())
        await asyncio.sleep(0)  # allow writer to reach the held shared lock
        self.assertFalse(writer_entered.is_set())
        release.set()
        result = await publication
        await writing
        self.assertEqual(result.status, "published")
        self.assertTrue(writer_entered.is_set())

    async def test_cancelled_publication_releases_guard(self):
        entered = asyncio.Event()
        async def callback():
            entered.set()
            await asyncio.Event().wait()
        task = asyncio.create_task(self.reader.publish_summary_if_current(A, 1, callback))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertFalse(self.store.lock.locked())

    async def test_successful_undo_restores_old_snapshot_without_revision_bump(self):
        await self.writer.begin()
        self.writer.finish(sql_error=True, undo_error=False)
        result = await self.reader.publish_summary_if_current(A, 1, self.publish)
        self.assertEqual(result.status, "published")
        self.assertEqual(result.snapshot.review_version, 1)


if __name__ == "__main__":
    unittest.main()
