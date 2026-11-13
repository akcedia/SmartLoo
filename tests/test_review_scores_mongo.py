"""read_review_scores() against a real MongoDB (#38, #45).

Run with SMARTLOO_TEST_MONGO=1 and a MongoDB at SMARTLOO_MONGO_URL
(default mongodb://localhost:27017). Each test uses its own throwaway database.
All reviews below are synthetic.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

pymongo = pytest.importorskip("pymongo")

from src.review_scores import ReviewStoreError, ensure_review_indexes, read_review_scores

pytestmark = pytest.mark.skipif(
    os.getenv("SMARTLOO_TEST_MONGO") != "1",
    reason="Requires a local MongoDB",
)

A, B, C = [f"00000000-0000-4000-8000-{n:012}" for n in range(1, 4)]
U, V = "00000000-0000-4000-9000-000000000001", "00000000-0000-4000-9000-000000000002"
# 1 October 2026 00:00 in Europe/Istanbul (UTC+3) is 30 September 21:00 UTC.
START = datetime(2026, 9, 30, 21, 0, tzinfo=timezone.utc)
END = START + timedelta(days=1)


@pytest.fixture
def reviews():
    client = pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://localhost:27017"),
                                 tz_aware=True, serverSelectionTimeoutMS=5000)
    name = f"smartloo_test_{uuid.uuid4().hex[:8]}"
    collection = client[name]["reviews"]
    ensure_review_indexes(collection)
    collection.insert_many([
        dict(id="r1", toilet_id=A, user_id=U, cleanliness_score=4, comment="Temiz, ali@example.com",
             created_at=START, is_anonymized=False),                          # start is inclusive
        dict(id="r2", toilet_id=A, user_id=V, cleanliness_score=2, comment="Sabun yok",
             created_at=START + timedelta(hours=5), is_anonymized=False),
        dict(id="r3", toilet_id=B, user_id=None, cleanliness_score=5, comment=None,
             created_at=START + timedelta(hours=6), is_anonymized=True),     # anonymized still counts
        dict(id="r4", toilet_id=A, user_id=None, cleanliness_score=1, comment=None,
             created_at=END, is_anonymized=True),                            # end is exclusive
        dict(id="r5", toilet_id=C, user_id=U, cleanliness_score=3, comment="Fena değil",
             created_at=START + timedelta(hours=1), is_anonymized=False),    # facility not requested
    ])
    yield collection
    client.drop_database(name)
    client.close()


def test_returns_scores_in_window_for_requested_facilities(reviews):
    rows = read_review_scores(reviews, [A, B], START, END)
    assert [(r["toilet_id"], r["cleanliness_score"]) for r in rows] == [(A, 4), (A, 2), (B, 5)]
    assert all(set(r) == {"toilet_id", "created_at", "cleanliness_score"} for r in rows)
    assert rows[0]["created_at"] == START and rows[0]["created_at"].tzinfo is not None


def test_istanbul_bounds_passed_as_utc(reviews):
    istanbul = timezone(timedelta(hours=3))
    rows = read_review_scores(reviews, [A], datetime(2026, 10, 1, tzinfo=istanbul),
                              datetime(2026, 10, 2, tzinfo=istanbul))
    assert [r["cleanliness_score"] for r in rows] == [4, 2]


def test_no_match_returns_empty_list(reviews):
    assert read_review_scores(reviews, [A], END + timedelta(days=1), END + timedelta(days=2)) == []
    assert read_review_scores(reviews, [], START, END) == []


def test_invalid_arguments_are_rejected(reviews):
    with pytest.raises(ValueError):
        read_review_scores(reviews, [A], END, START)
    with pytest.raises(ValueError):
        read_review_scores(reviews, [A], datetime(2026, 10, 1), END)
    with pytest.raises(ValueError):
        read_review_scores(reviews, ["not-a-uuid"], START, END)


def test_one_review_per_user_and_toilet(reviews):
    with pytest.raises(pymongo.errors.DuplicateKeyError):
        reviews.insert_one(dict(id="dup", toilet_id=A, user_id=U, cleanliness_score=5, created_at=START))
    reviews.insert_one(dict(id="anon", toilet_id=A, user_id=None, cleanliness_score=5, created_at=START))


def test_store_failure_raises_error():
    client = pymongo.MongoClient("mongodb://localhost:1", serverSelectionTimeoutMS=300)
    with pytest.raises(ReviewStoreError):
        read_review_scores(client["x"]["reviews"], [A], START, END)
