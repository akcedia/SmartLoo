"""Review score reader for admin analytics (#38, #45).

    read_review_scores(collection, toilet_ids, start_utc, end_utc)

returns one {toilet_id, created_at, cleanliness_score} dict per review of the given
facilities with start_utc <= created_at < end_utc, oldest first. Comment text and
user identity are never read. The analytics layer computes Europe/Istanbul day
boundaries and passes them as UTC. No match gives []; a store failure raises
ReviewStoreError.

Reviews live in the MongoDB `reviews` collection (er-data-dictionary.md §2.3).
pymongo is imported lazily, so the rest of the API runs without it.
"""

import os
import uuid
from datetime import datetime, timezone

PROJECTION = {"_id": 0, "toilet_id": 1, "created_at": 1, "cleanliness_score": 1}


class ReviewStoreError(Exception):
    """MongoDB could not be read; the caller should answer 503, not an empty result."""


def review_collection():
    """The `reviews` collection from SMARTLOO_MONGO_URL (local default mongodb://localhost:27017)."""
    from pymongo import MongoClient

    client = MongoClient(
        os.getenv("SMARTLOO_MONGO_URL", "mongodb://localhost:27017"),
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
    )
    return client[os.getenv("SMARTLOO_MONGO_DB", "smartloo")]["reviews"]


def ensure_review_indexes(collection):
    """One review per (toilet, user) for signed-in authors (TC-32); anonymized reviews are exempt."""
    collection.create_index(
        [("toilet_id", 1), ("user_id", 1)],
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
        name="one_review_per_user_and_toilet",
    )
    collection.create_index([("toilet_id", 1), ("created_at", 1)], name="reviews_by_toilet_and_time")


def _utc(value, name):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError(f"{name} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def read_review_scores(collection, toilet_ids, start_utc, end_utc):
    start, end = _utc(start_utc, "start_utc"), _utc(end_utc, "end_utc")
    if start >= end:
        raise ValueError("start_utc must be before end_utc")
    ids = [str(uuid.UUID(str(t))) for t in toilet_ids]
    if not ids:
        return []

    from pymongo.errors import PyMongoError

    query = {"toilet_id": {"$in": ids}, "created_at": {"$gte": start, "$lt": end}}
    try:
        rows = list(collection.find(query, PROJECTION).sort([("created_at", 1), ("toilet_id", 1)]))
    except PyMongoError as exc:
        raise ReviewStoreError("Review store unavailable") from exc

    return [
        {
            "toilet_id": row["toilet_id"],
            # MongoDB stores UTC; a client opened without tz_aware returns it naive.
            "created_at": row["created_at"].replace(tzinfo=row["created_at"].tzinfo or timezone.utc),
            "cleanliness_score": row["cleanliness_score"],
        }
        for row in rows
    ]
