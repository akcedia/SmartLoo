"""Writer/publication ordering without depending on the unmerged AI package.

The AI envelope types are stubbed here. The real #68 parser/consumer is checked
separately with actual PostgreSQL, MongoDB and Redis, as recorded in the handoff.
"""

import asyncio
import sys
from types import ModuleType, SimpleNamespace

import pytest

from test_reviews import A, env


@pytest.fixture
def publication(env, monkeypatch):
    _, _, app = env
    contract = ModuleType("src.ai_review_contract")
    contract.parse_summary_snapshot = lambda payload, **kwargs: SimpleNamespace(**payload)
    contract.SummaryPublication = lambda status, snapshot, value=None: SimpleNamespace(
        status=status, snapshot=snapshot, value=value,
    )
    monkeypatch.setitem(sys.modules, contract.__name__, contract)
    return app.state.review_ai_coordinator, app.state.reviews


def test_current_publication_runs_once_per_request_and_stale_never_calls(publication):
    coordinator, _ = publication
    calls = []

    async def callback():
        calls.append(True)
        return {"summary": "Temiz"}

    async def scenario():
        for _ in range(2):
            result = await coordinator.publish_summary_if_current(A, 0, callback)
            assert result.status == "published" and result.value == {"summary": "Temiz"}
        stale = await coordinator.publish_summary_if_current(A, 1, callback)
        assert stale.status == "stale" and stale.value is None

    asyncio.run(scenario())
    assert len(calls) == 2


def test_busy_and_pending_publication_never_invoke_callback(publication):
    coordinator, reviews = publication

    async def forbidden():
        pytest.fail("Busy or pending publication must not call cache/response callback")

    async def scenario():
        with reviews.coordination.guard(A) as writer:
            operation = writer.begin("synthetic-id", None)
            result = await coordinator.publish_summary_if_current(A, 0, forbidden)
            assert result.status == "busy" and result.value is None
        result = await coordinator.publish_summary_if_current(A, 0, forbidden)
        assert result.status == "repair_required" and result.value is None
        with reviews.coordination.guard(A) as writer:
            writer.clear(operation["operation_id"])

    asyncio.run(scenario())


def test_cancelled_publication_releases_writer_guard(publication):
    coordinator, reviews = publication

    async def scenario():
        entered = asyncio.Event()

        async def blocked():
            entered.set()
            await asyncio.Event().wait()

        task = asyncio.create_task(coordinator.publish_summary_if_current(A, 0, blocked))
        await asyncio.wait_for(entered.wait(), 3)
        with reviews.coordination.guard(A, wait=False) as writer:
            assert writer is None
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        with reviews.coordination.guard(A, wait=False) as writer:
            assert writer is not None

    asyncio.run(scenario())


def test_callback_failure_releases_guard(publication):
    coordinator, reviews = publication

    async def broken():
        raise RuntimeError("Synthetic callback failure")

    with pytest.raises(RuntimeError, match="Synthetic callback failure"):
        asyncio.run(coordinator.publish_summary_if_current(A, 0, broken))
    with reviews.coordination.guard(A, wait=False) as writer:
        assert writer is not None


def test_publication_deadline_releases_guard(publication):
    coordinator, reviews = publication

    async def never_finishes():
        await asyncio.Event().wait()

    with pytest.raises(TimeoutError):
        asyncio.run(coordinator.publish_summary_if_current(A, 0, never_finishes))
    with reviews.coordination.guard(A, wait=False) as writer:
        assert writer is not None
