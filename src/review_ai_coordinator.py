"""Async bridge to Emir's #68 ConsistentReviewPort, using the real writer guard.

The AI types are imported only when the bridge is used after #68 integration.
The synchronous review service has no dependency on an unmerged AI package.
"""

import asyncio
import concurrent.futures
import threading
import uuid


class ReviewAICoordinator:
    def __init__(self, reviews):
        self.reviews = reviews

    async def snapshot_for_summary(self, toilet_id, *, limit=50):
        from src.ai_review_contract import parse_summary_snapshot

        payload = await asyncio.to_thread(self.reviews.read_summary_snapshot, toilet_id, limit)
        return parse_summary_snapshot(payload, expected_toilet_id=toilet_id)

    async def _publication(self, toilet_id, expected_version, publish, acquired, metadata):
        from src.ai_review_contract import SummaryPublication, parse_summary_snapshot

        operation = metadata["operation"]
        state = "ready"
        if not acquired:
            state = "busy"
        elif operation is not None:
            state = "repair_required"
        payload = {
            "protocol_version": 1, "toilet_id": toilet_id, "state": state,
            "review_version": metadata["review_version"],
            "operation_id": operation["operation_id"] if operation else None,
            "review_count": metadata["review_count"],
            "average_cleanliness": metadata["average_cleanliness"], "reviews": [],
        }
        snapshot = parse_summary_snapshot(payload, expected_toilet_id=toilet_id)
        if state != "ready":
            return SummaryPublication(state, snapshot)
        if snapshot.review_version != expected_version:
            return SummaryPublication("stale", snapshot)
        # No OpenAI call belongs in this callback. Only bounded cache/response work.
        async with asyncio.timeout(2):
            value = await publish()
        if not isinstance(value, dict):
            raise ValueError("Summary publication must return a response object")
        return SummaryPublication("published", snapshot, value)

    async def publish_summary_if_current(self, toilet_id, expected_version, publish):
        key = str(uuid.UUID(toilet_id))
        if type(expected_version) is not int or expected_version < 0:
            raise ValueError("Invalid expected review version")
        stop = threading.Event()
        worker = asyncio.create_task(asyncio.to_thread(
            self._guarded_publication, key, expected_version, publish,
            asyncio.get_running_loop(), stop,
        ))
        try:
            return await asyncio.shield(worker)
        except asyncio.CancelledError:
            stop.set()
            # Wait for the guard's owner to cancel the callback and close its
            # SQL session before returning cancellation to the caller.
            await asyncio.shield(asyncio.gather(worker, return_exceptions=True))
            raise

    def _guarded_publication(self, key, expected_version, publish, loop, stop):
        coordination = self.reviews.coordination
        # This worker owns acquisition and release in one thread. The bounded
        # async cache callback runs on the application's original event loop.
        # No event-loop policy or synchronous DB work is imposed on that loop.
        with coordination.guard(key, wait=False) as session:
            metadata = coordination.metadata(key)
            future = asyncio.run_coroutine_threadsafe(
                self._publication(key, expected_version, publish, session is not None, metadata), loop,
            )
            try:
                while True:
                    if stop.is_set():
                        future.cancel()
                        raise concurrent.futures.CancelledError()
                    try:
                        return future.result(timeout=0.05)
                    except concurrent.futures.TimeoutError:
                        if future.done():
                            return future.result()
            finally:
                if not future.done():
                    future.cancel()
