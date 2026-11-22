"""Strict local schema plus mandatory language/grounding gates for #59.

Categories follow the existing design proposal, pending team acceptance. Schema
alone proves neither Turkish language nor grounded claims. Both checks are
required async policies, with no default approval. Rejection triggers the
SummaryService fallback. Never put raw model output in error messages/logs.
"""

import json
from copy import deepcopy

CATEGORIES = frozenset({"cleanliness", "odor", "supplies", "accessibility", "safety"})
STATES = frozenset({"positive", "negative", "mixed", "unknown"})
FIELDS = frozenset({"summary", "pros", "cons", "recommendation", "categories"})


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def _reject_constant(_):
    raise ValueError("nonfinite_json_number")


def validate_summary_schema(candidate):
    if isinstance(candidate, str):
        if len(candidate) > 16000:
            raise ValueError("model_output_too_large")
        try:
            candidate = json.loads(candidate, object_pairs_hook=_unique_object,
                                   parse_constant=_reject_constant)
        except (ValueError, RecursionError):
            raise ValueError("invalid_model_json") from None
    if not isinstance(candidate, dict) or set(candidate) != FIELDS:
        raise ValueError("invalid_summary_fields")
    summary = candidate["summary"]
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 400:
        raise ValueError("invalid_summary_text")
    for field in ("pros", "cons"):
        phrases = candidate[field]
        if not isinstance(phrases, list) or len(phrases) > 3:
            raise ValueError("invalid_summary_phrases")
        if any(not isinstance(p, str) or not p.strip() or len(p) > 100 for p in phrases):
            raise ValueError("invalid_summary_phrase")
    if candidate["recommendation"] not in ("recommended", "acceptable", "avoid"):
        raise ValueError("invalid_recommendation")
    categories = candidate["categories"]
    if not isinstance(categories, dict) or set(categories) != CATEGORIES:
        raise ValueError("invalid_categories")
    if any(not isinstance(state, str) or state not in STATES for state in categories.values()):
        raise ValueError("invalid_category_state")
    return deepcopy(candidate)


class SummaryOutputValidator:
    def __init__(self, *, language_check, grounding_check, privacy_check):
        self.language_check = language_check
        self.grounding_check = grounding_check
        self.privacy_check = privacy_check

    async def __call__(self, candidate, evidence):
        output = validate_summary_schema(candidate)
        texts = [output["summary"], *output["pros"], *output["cons"]]
        for text in texts:
            if await self.privacy_check(text) is not True:
                raise ValueError("output_privacy_not_verified")
            if await self.language_check(text) is not True:
                raise ValueError("output_language_not_verified")
        # Check all claims, recommendation and category states, including
        # unsupported positive/safety claims and contradictory evidence.
        if await self.grounding_check(deepcopy(output), deepcopy(evidence)) is not True:
            raise ValueError("output_grounding_not_verified")
        return output
