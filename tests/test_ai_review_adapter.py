"""Contract bridge tests using #50's proposed record shape, without live stores."""

import unittest
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from src.ai_evidence import EvidencePreparer
from src.ai_review_adapter import ReviewServiceRepository, ReviewStatistics, adapt_eligible_reviews
from src.ai_summary_service import SummaryService

NOW = datetime(2026, 11, 17, 9, tzinfo=timezone.utc)


def payload():
    return {"review_version": 4, "reviews": [
        {"id": "b", "cleanliness_score": 4, "comment": "Temiz.", "created_at": NOW},
        {"id": "a", "cleanliness_score": 3, "comment": "Sabun eksik.", "created_at": NOW},
        {"id": "newest", "cleanliness_score": 5, "comment": "Temizdi.",
         "created_at": NOW + timedelta(seconds=1)},
    ]}


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.stats = ReviewStatistics(4, 20, 3.5, consistent=True)

    def test_maps_proposed_version_and_order(self):
        result = adapt_eligible_reviews(payload(), self.stats)
        self.assertEqual(result.revision, "4")
        self.assertEqual([r.id for r in result.reviews], ["newest", "a", "b"])
        self.assertTrue(result.consistent)

    def test_totals_are_not_computed_from_top_50_comments(self):
        result = adapt_eligible_reviews(payload(), self.stats)
        self.assertEqual(result.review_count, 20)
        self.assertEqual(result.average_cleanliness, 3.5)
        self.assertEqual(len(result.reviews), 3)

    def test_unguaranteed_or_mismatched_reads_are_not_consistent(self):
        for stats in (replace(self.stats, consistent=False), replace(self.stats, review_version=5)):
            self.assertFalse(adapt_eligible_reviews(payload(), stats).consistent)
        self.assertFalse(ReviewStatistics(4, 20, 3.5).consistent)

    def test_rejects_identity_fields_and_duplicate_ids(self):
        for field in ("user_id", "display_name", "email"):
            data = payload()
            data["reviews"][0][field] = "must-not-cross-boundary"
            with self.assertRaises(ValueError):
                adapt_eligible_reviews(data, self.stats)
        data = payload()
        data["reviews"][1]["id"] = "b"
        with self.assertRaises(ValueError):
            adapt_eligible_reviews(data, self.stats)

    def test_rejects_invalid_score_timestamp_and_comment(self):
        for field, value in (("cleanliness_score", True), ("cleanliness_score", 0),
                             ("created_at", "2026-11-17"), ("created_at", NOW.replace(tzinfo=None)),
                             ("comment", "a" * 1001)):
            data = payload()
            data["reviews"][0][field] = value
            with self.subTest(field=field, value_type=type(value).__name__):
                with self.assertRaises(ValueError):
                    adapt_eligible_reviews(data, self.stats)

    def test_rejects_nonfinite_and_invalid_statistics(self):
        for stats in (replace(self.stats, average_cleanliness=float("nan")),
                      replace(self.stats, average_cleanliness=True),
                      replace(self.stats, average_cleanliness=None),
                      replace(self.stats, review_count=-1), replace(self.stats, review_version=True)):
            with self.assertRaises(ValueError):
                adapt_eligible_reviews(payload(), stats)

    def test_empty_facility_preserves_null_average(self):
        result = adapt_eligible_reviews({"review_version": 0, "reviews": []},
                                       ReviewStatistics(0, 0, None, True))
        self.assertIsNone(result.average_cleanliness)
        self.assertEqual(result.review_count, 0)

    def test_does_not_mutate_input(self):
        data = payload()
        original = deepcopy(data)
        adapt_eligible_reviews(data, self.stats)
        self.assertEqual(data, original)

    def test_PR67_isolated_store_iso_timestamps_are_accepted(self):
        data = payload()
        data["reviews"][0]["created_at"] = NOW.isoformat()
        data["reviews"][1]["created_at"] = NOW.isoformat().replace("+00:00", "Z")
        result = adapt_eligible_reviews(data, self.stats)
        self.assertTrue(all(isinstance(r.created_at, datetime) for r in result.reviews))


class RepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_calls_bridge_with_facility_and_limit(self):
        bridge = AsyncMock(return_value=(payload(), ReviewStatistics(4, 20, 3.5, True)))
        result = await ReviewServiceRepository(bridge).snapshot("facility-A")
        bridge.assert_awaited_once_with("facility-A", limit=50)
        self.assertEqual(result.review_count, 20)

    async def test_store_errors_are_not_empty_success(self):
        bridge = AsyncMock(side_effect=ConnectionError("private-store-error"))
        with self.assertRaises(ConnectionError):
            await ReviewServiceRepository(bridge).snapshot("facility-A")

    async def test_uncertain_read_never_reaches_provider_or_cache(self):
        bridge = AsyncMock(return_value=(payload(), ReviewStatistics(4, 20, 3.5)))
        provider = AsyncMock()
        cache = AsyncMock()
        service = SummaryService(ReviewServiceRepository(bridge), cache, provider,
            prepare_evidence=EvidencePreparer(privacy_check=AsyncMock(return_value=True)),
            validate_output=AsyncMock(), policy_version="contract-tests-v1")
        result = await service.summarize("facility-A")
        self.assertIsNone(result["summary"])
        self.assertEqual(result["review_count"], 20)
        provider.assert_not_awaited()
        cache.get.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
