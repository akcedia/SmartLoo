import unittest
from unittest.mock import AsyncMock

from src.ai_recommendations import recommend, select_candidates


def facility(id, distance=100, accessible=True, free=True, average=4, sentiment=None):
    return {"id": id, "distance_m": distance, "has_disabled_access": accessible,
            "is_free": free, "average_cleanliness": average, "review_sentiment": sentiment}


class CandidateTests(unittest.TestCase):
    def test_TC17_fixture_only_A_satisfies_preferences(self):
        rows = [facility("A"), facility("B", accessible=None), facility("C", free=False)]
        result = select_candidates(rows, {"has_disabled_access": True, "is_free": True})
        self.assertEqual([row["id"] for row in result], ["A"])

    def test_false_preference_does_not_accept_unknown(self):
        rows = [facility("unknown", free=None), facility("paid", free=False)]
        self.assertEqual([row["id"] for row in select_candidates(rows, {"is_free": False})], ["paid"])

    def test_maximum_three_and_deterministic_ranking(self):
        rows = [facility("far", 200), facility("unknown", average=None),
                facility("low", average=3), facility("high-negative", sentiment=-1),
                facility("high-positive", sentiment=1)]
        result = select_candidates(rows, {})
        self.assertEqual([row["id"] for row in result], ["high-positive", "high-negative", "low"])

    def test_unknowns_remain_null_and_input_not_mutated(self):
        row = facility("A", average=None)
        result = select_candidates([row], {})
        self.assertIsNone(result[0]["average_cleanliness"])
        self.assertNotIn("has_baby_changing", row)

    def test_invalid_preferences_and_candidate_values_rejected(self):
        for preferences in ({"is_free": 1}, {"is_free": None}, {"unknown": True}):
            with self.assertRaises(ValueError):
                select_candidates([facility("A")], preferences)
        for row in (facility("A", accessible=1), facility("A", distance=float("nan")),
                    facility("A", average=0), facility("A", sentiment=2)):
            with self.assertRaises(ValueError):
                select_candidates([row], {})


class ReasonTests(unittest.IsolatedAsyncioTestCase):
    async def test_provider_error_preserves_eligible_candidates_without_reason(self):
        provider = AsyncMock(side_effect=TimeoutError())
        result = await recommend([facility("A"), facility("B", accessible=None)],
            {"has_disabled_access": True}, reason_provider=provider,
            validate_reason=AsyncMock(return_value=True))
        self.assertEqual([r["id"] for r in result["results"]], ["A"])
        self.assertNotIn("reason", result["results"][0])
        self.assertFalse(result["ai_reasons_available"])

    async def test_valid_fixture_reason_and_minimal_provider_payload(self):
        row = {**facility("private-id"), "user_id": "secret", "lat": 41, "lon": 29}
        provider = AsyncMock(return_value={"c1": "Ücretsiz ve erişilebilir bir tesis."})
        result = await recommend([row], {"is_free": True}, reason_provider=provider,
            validate_reason=AsyncMock(return_value=True))
        facts = provider.call_args.args[0][0]
        self.assertTrue(result["ai_reasons_available"])
        self.assertIn("reason", result["results"][0])
        self.assertEqual(facts["candidate_ref"], "c1")
        for key in ("id", "user_id", "lat", "lon"):
            self.assertNotIn(key, facts)

    async def test_outside_candidate_or_unsupported_reason_cannot_publish(self):
        for reasons, decision in (({"outside": "invented"}, True), ({"c1": "unsafe claim"}, False)):
            result = await recommend([facility("A")], {},
                reason_provider=AsyncMock(return_value=reasons),
                validate_reason=AsyncMock(return_value=decision))
            self.assertFalse(result["ai_reasons_available"])
            self.assertNotIn("reason", result["results"][0])

    async def test_empty_candidates_skip_provider(self):
        provider = AsyncMock()
        result = await recommend([], {}, reason_provider=provider, validate_reason=AsyncMock())
        self.assertEqual(result["results"], [])
        provider.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
