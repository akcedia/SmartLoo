"""Adapt Fırat's proposed #50 review contract to Emir's #59 service.

Source: docs/contracts/reviews-service.md at #50 head 2be3e821.
The upstream function is PLANNED, not currently imported or implemented here.
The caller must assemble a store-consistent read of payload and statistics;
this adapter does not manufacture a distributed snapshot from independent reads.
"""

from dataclasses import dataclass
from datetime import datetime
from math import isfinite

from src.ai_evidence import ReviewText
from src.ai_summary_service import ReviewSnapshot


@dataclass(frozen=True)
class ReviewStatistics:
    review_version: int
    review_count: int
    average_cleanliness: float | None
    # Must come from a coordinated read/write boundary, not just equal versions.
    consistent: bool = False


def adapt_eligible_reviews(payload, statistics):
    """Map pre-redacted review records, preserving actual aggregate statistics.

    The review ID stays local; EvidencePreparer replaces it before provider use.
    Invalid records fail the whole read. They are not silently omitted because
    that would obscure the source contract error and could change AI evidence.
    """
    if not isinstance(payload, dict) or set(payload) != {"review_version", "reviews"}:
        raise ValueError("invalid_eligible_review_payload")
    if not isinstance(statistics, ReviewStatistics):
        raise ValueError("invalid_review_statistics")
    version = payload["review_version"]
    for value in (version, statistics.review_version, statistics.review_count):
        if type(value) is not int or value < 0:
            raise ValueError("invalid_review_version_or_count")
    average = statistics.average_cleanliness
    if statistics.review_count == 0:
        if average is not None:
            raise ValueError("zero_reviews_requires_null_average")
    elif type(average) not in (int, float) or not isfinite(average) or not 1 <= average <= 5:
        raise ValueError("invalid_review_average")
    rows = payload["reviews"]
    if not isinstance(rows, list) or len(rows) > 50 or len(rows) > statistics.review_count:
        raise ValueError("invalid_eligible_review_count")
    records = []
    ids = set()
    for row in rows:
        # In particular, no author/user/name/email fields enter this boundary.
        if not isinstance(row, dict) or set(row) != {"id", "cleanliness_score", "comment", "created_at"}:
            raise ValueError("invalid_eligible_review_record")
        id = row["id"]
        score = row["cleanliness_score"]
        date = row["created_at"]
        comment = row["comment"]
        if not isinstance(id, str) or not id.strip() or id in ids:
            raise ValueError("invalid_or_duplicate_review_id")
        if type(score) is not int or not 1 <= score <= 5:
            raise ValueError("invalid_review_score")
        if not isinstance(date, datetime) or date.tzinfo is None or date.utcoffset() is None:
            raise ValueError("invalid_review_timestamp")
        if comment is not None and (not isinstance(comment, str) or len(comment) > 1000):
            raise ValueError("invalid_review_comment")
        ids.add(id)
        # Upstream contract promises redacted comments; we still retain the
        # downstream EvidencePreparer and mandatory residual privacy policy.
        records.append(ReviewText(id, date, comment, author_identifiers=()))
    records.sort(key=lambda row: row.id)
    records.sort(key=lambda row: row.created_at, reverse=True)
    return ReviewSnapshot(
        revision=str(version), reviews=tuple(records),
        review_count=statistics.review_count, average_cleanliness=average,
        consistent=statistics.consistent is True and version == statistics.review_version,
    )


class ReviewServiceRepository:
    def __init__(self, read_consistent_snapshot):
        """Async bridge returns (eligible payload, ReviewStatistics).

        The bridge is owned by the review/store integration. It must distinguish
        missing facilities from store failures. No success/default data is
        returned when its read fails. No runtime dependency on an unmerged PR.
        """
        self.read_consistent_snapshot = read_consistent_snapshot

    async def snapshot(self, toilet_id):
        payload, statistics = await self.read_consistent_snapshot(toilet_id, limit=50)
        return adapt_eligible_reviews(payload, statistics)
