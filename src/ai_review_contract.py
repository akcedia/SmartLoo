"""Proposed #67/#68 consistent-review port; not a distributed lock backend.

This validates a complete internal snapshot. It does not certify consistency:
only the shared writer/reader coordinator can supply that guarantee. Existing
independent Mongo/SQL reads must not simply label themselves ready.
"""

from copy import deepcopy
from dataclasses import dataclass
from math import isfinite
from typing import Awaitable, Callable, Protocol
from uuid import UUID


@dataclass(frozen=True)
class SummarySnapshot:
    toilet_id: str
    state: str
    review_version: int
    operation_id: str | None
    review_count: int
    average_cleanliness: float | None
    reviews: tuple

    @property
    def ready(self):
        return self.state == "ready"


def parse_summary_snapshot(payload, *, expected_toilet_id):
    fields = {"protocol_version", "toilet_id", "state", "review_version", "operation_id",
              "review_count", "average_cleanliness", "reviews"}
    if not isinstance(payload, dict) or set(payload) != fields:
        raise ValueError("invalid_snapshot_fields")
    if type(payload["protocol_version"]) is not int or payload["protocol_version"] != 1:
        raise ValueError("unsupported_snapshot_protocol")
    try:
        actual = str(UUID(payload["toilet_id"]))
        expected = str(UUID(expected_toilet_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("invalid_snapshot_facility") from None
    if actual != expected:
        raise ValueError("snapshot_facility_mismatch")
    state = payload["state"]
    if state not in ("ready", "busy", "writing", "repair_required"):
        raise ValueError("invalid_snapshot_state")
    version, count = payload["review_version"], payload["review_count"]
    if type(version) is not int or version < 0 or type(count) is not int or count < 0:
        raise ValueError("invalid_snapshot_version_or_count")
    average = payload["average_cleanliness"]
    if count == 0:
        if average is not None:
            raise ValueError("empty_snapshot_requires_null_average")
    elif type(average) not in (int, float) or not isfinite(average) or not 1 <= average <= 5:
        raise ValueError("invalid_snapshot_average")
    operation = payload["operation_id"]
    if operation is not None and (not isinstance(operation, str) or not operation.strip()):
        raise ValueError("invalid_snapshot_operation")
    if (state == "ready" and operation is not None) or (state in ("writing", "repair_required") and operation is None):
        raise ValueError("snapshot_operation_state_mismatch")
    rows = payload["reviews"]
    if not isinstance(rows, list) or len(rows) > 50 or len(rows) > count:
        raise ValueError("invalid_snapshot_review_count")
    if state != "ready" and rows:
        raise ValueError("unready_snapshot_must_not_expose_review_text")
    return SummarySnapshot(actual, state, version, operation, count, average,
                           tuple(deepcopy(rows)))


@dataclass(frozen=True)
class SummaryPublication:
    status: str  # published / stale / busy / repair_required
    snapshot: SummarySnapshot
    value: dict | None = None


class ConsistentReviewPort(Protocol):
    async def snapshot_for_summary(self, toilet_id: str, *, limit: int = 50) -> SummarySnapshot:
        """Read texts, actual totals/version and state under the writer guard.

        Busy/dirty reads return no texts and last verified committed statistics.
        Unavailable metadata raises a store error; never invent count=0.
        """
        ...

    async def publish_summary_if_current(
        self, toilet_id: str, expected_version: int,
        publish: Callable[[], Awaitable[dict]],
    ) -> SummaryPublication:
        """Under the SAME guard: check ready/version, then await bounded publish.

        Invoke callback exactly once only if current. It includes optional cache
        write and response assembly, not the OpenAI call. Callback failure and
        cancellation release the guard. Rejecting returns no candidate value.
        """
        ...
