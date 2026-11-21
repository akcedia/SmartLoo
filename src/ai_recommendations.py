"""Independent FR-04 candidate selection and bounded optional AI reasons.

Discovery supplies real nearby candidate fields; authorization/input coordinates
remain with the API. Ranking policy v1 is a review proposal: distance ascending,
then known cleanliness descending, then verified sentiment descending, stable ID.
No weights are asserted as an approved requirement. Unknown values stay unknown.
"""

import asyncio
from copy import deepcopy
from math import isfinite

AMENITIES = frozenset({"has_disabled_access", "has_baby_changing", "is_free"})


def select_candidates(candidates, preferences):
    if not isinstance(preferences, dict) or not set(preferences) <= AMENITIES:
        raise ValueError("invalid_preferences")
    if any(type(value) is not bool for value in preferences.values()):
        raise ValueError("preferences_must_be_boolean")
    selected = []
    ids = set()
    for row in candidates:
        if not isinstance(row, dict):
            raise ValueError("invalid_candidate_record")
        id = row.get("id")
        distance = row.get("distance_m")
        average = row.get("average_cleanliness")
        sentiment = row.get("review_sentiment")
        if not isinstance(id, str) or not id or id in ids:
            raise ValueError("invalid_or_duplicate_facility_id")
        ids.add(id)
        if type(distance) not in (int, float) or not isfinite(distance) or distance < 0:
            raise ValueError("invalid_candidate_distance")
        for value, low, high in ((average, 1, 5), (sentiment, -1, 1)):
            if value is not None and (type(value) not in (int, float) or not isfinite(value) or not low <= value <= high):
                raise ValueError("invalid_candidate_ranking_value")
        if any(row.get(key) is not None and type(row[key]) is not bool for key in AMENITIES):
            raise ValueError("invalid_candidate_amenity")
        # Identity comparisons exclude unknown and numeric 0/1 from both filters.
        if any(row.get(key) is not value for key, value in preferences.items()):
            continue
        selected.append({"id": id, "distance_m": distance,
            "average_cleanliness": average, "review_sentiment": sentiment,
            **{key: row.get(key) for key in AMENITIES}})
    selected.sort(key=lambda row: (row["distance_m"],
        row["average_cleanliness"] is None, -(row["average_cleanliness"] or 0),
        row["review_sentiment"] is None, -(row["review_sentiment"] or 0), row["id"]))
    return selected[:3]


async def recommend(candidates, preferences, *, reason_provider=None,
                    validate_reason=None, timeout_seconds=10):
    if not 0 < timeout_seconds <= 10:
        raise ValueError("invalid_recommendation_timeout")
    selected = select_candidates(candidates, preferences)
    result = {"results": deepcopy(selected), "ai_reasons_available": False}
    if not selected or reason_provider is None or validate_reason is None:
        return result
    # Send transient candidate refs and required facts only, never exact origin,
    # account/session fields, arbitrary source metadata or permanent facility IDs.
    evidence = [{"candidate_ref": f"c{i+1}", **{k: v for k, v in row.items() if k != "id"}}
                for i, row in enumerate(selected)]

    async def produce():
        reasons = await reason_provider(deepcopy(evidence))
        expected = {row["candidate_ref"] for row in evidence}
        if not isinstance(reasons, dict) or set(reasons) != expected:
            raise ValueError("invalid_recommendation_reason_refs")
        output = deepcopy(selected)
        for row, facts in zip(output, evidence):
            reason = reasons[facts["candidate_ref"]]
            if not isinstance(reason, str) or not reason.strip() or len(reason) > 400:
                raise ValueError("invalid_recommendation_reason")
            # Required policy checks Turkish, one sentence, PII and every claim.
            if await validate_reason(reason, deepcopy(facts)) is not True:
                raise ValueError("recommendation_reason_not_verified")
            row["reason"] = reason
        return {"results": output, "ai_reasons_available": True}

    try:
        return await asyncio.wait_for(produce(), timeout=timeout_seconds)
    except Exception:
        # Preserve hard-filtered candidates. Never invent a substitute AI reason
        # or return provider text from an error. Nearby discovery is independent.
        return result
