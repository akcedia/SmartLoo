import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from src.ai_gemini import GeminiRecommendationProvider, GeminiSummaryProvider, MODEL
from src.ai_recommendations import recommend, select_candidates, validate_recommendation_reason


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


def gemini_reply(text, status=200):
    body = {"candidates": [{"finishReason": "STOP", "content": {
        "role": "model", "parts": [{"text": text}],
    }}]}
    return SimpleNamespace(status_code=status, content=json.dumps(body).encode(), json=lambda: body)


class GeminiReasonTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = SimpleNamespace(post=AsyncMock())
        self.provider = GeminiRecommendationProvider(self.client, api_key="test-key", model=MODEL)
        self.rows = [facility("private-fixture-id"), facility("B", accessible=None), facility("C", free=False)]
        self.preferences = {"has_disabled_access": True, "is_free": True}
        self.valid_row = {"candidate_ref": "c1", "claims": ["free", "accessible"],
                          "reason": "Tesis ücretsiz ve engelli erişimine uygun."}

    async def run_recommendation(self, rows=None, preferences=None):
        return await recommend(
            self.rows if rows is None else rows,
            self.preferences if preferences is None else preferences,
            reason_provider=self.provider, validate_reason=validate_recommendation_reason,
        )

    async def test_tc17_only_matching_candidate_and_verified_reason(self):
        self.client.post.return_value = gemini_reply(json.dumps({"recommendations": [self.valid_row]}))
        result = await self.run_recommendation()
        self.assertTrue(result["ai_reasons_available"])
        self.assertEqual([(row["id"], row["reason"]) for row in result["results"]],
                         [("private-fixture-id", self.valid_row["reason"])])
        self.client.post.assert_awaited_once()
        _, options = self.client.post.call_args
        self.assertFalse(options["follow_redirects"])
        content = json.loads(options["json"]["contents"][0]["parts"][0]["text"])
        self.assertEqual(content, {"candidates": [{"candidate_ref": "c1",
                                                   "allowed_claims": ["free", "accessible"]}]})

    async def test_bad_references_and_claims_keep_candidate_without_reason(self):
        cases = [
            {"recommendations": [{**self.valid_row, "candidate_ref": "c2"}]},
            {"recommendations": [{**self.valid_row, "claims": ["free", "free"]}]},
            {"recommendations": [{**self.valid_row, "claims": ["baby_changing"]}]},
            {"recommendations": [{**self.valid_row, "reason": "Tesis güvenlik denetiminden geçti."}]},
            {"recommendations": [{**self.valid_row, "extra": "unexpected"}]},
            {"recommendations": []},
        ]
        responses = [json.dumps(case) for case in cases]
        responses.extend(["not json", '{"recommendations":[],"recommendations":[]}'])
        for text in responses:
            with self.subTest(text=text):
                self.client.post.return_value = gemini_reply(text)
                result = await self.run_recommendation()
                self.assertFalse(result["ai_reasons_available"])
                self.assertEqual([row["id"] for row in result["results"]], ["private-fixture-id"])
                self.assertNotIn("reason", result["results"][0])

    async def test_quota_and_timeout_preserve_candidates(self):
        self.client.post.return_value = gemini_reply("", status=429)
        quota = await self.run_recommendation()
        self.client.post.side_effect = TimeoutError()
        timeout = await self.run_recommendation()
        self.assertEqual(quota, timeout)
        self.assertFalse(timeout["ai_reasons_available"])
        self.assertEqual([row["id"] for row in timeout["results"]], ["private-fixture-id"])
        self.assertEqual(self.client.post.await_count, 2)

    async def test_empty_and_unknown_evidence_make_no_model_request(self):
        empty = await self.run_recommendation(rows=[])
        unknown = await self.run_recommendation(
            rows=[facility("unknown", free=None, accessible=None)], preferences={})
        self.client.post.assert_not_awaited()
        self.assertEqual(empty["results"], [])
        self.assertEqual([row["id"] for row in unknown["results"]], ["unknown"])
        self.assertFalse(unknown["ai_reasons_available"])

    async def test_summary_still_uses_its_original_schema_and_token_budget(self):
        output = {
            "summary": "Temiz.", "pros": ["Temiz."], "cons": [], "recommendation": "recommended",
            "categories": {"cleanliness": "positive", "odor": "unknown", "supplies": "unknown",
                           "accessibility": "unknown", "safety": "unknown"},
        }
        self.client.post.return_value = gemini_reply(json.dumps(output))
        provider = GeminiSummaryProvider(self.client, api_key="test-key", model=MODEL)
        evidence = [{"request_review_ref": f"r{i}", "text": "Temizdi."} for i in range(1, 4)]
        self.assertEqual(await provider(evidence), output)
        request = self.client.post.call_args.kwargs["json"]
        self.assertEqual(request["generationConfig"]["maxOutputTokens"], 1200)
        self.assertEqual(json.loads(request["contents"][0]["parts"][0]["text"]),
                         {"language": "tr", "reviews": evidence})


if __name__ == "__main__":
    unittest.main()
