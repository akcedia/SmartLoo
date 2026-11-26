"""Independent FR-04 candidate selection and bounded optional AI reasons.

Discovery supplies real nearby candidate fields; authorization/input coordinates
remain with the API. Ranking policy v1 is a review proposal: distance ascending,
then known cleanliness descending, then verified sentiment descending, stable ID.
No weights are asserted as an approved requirement. Unknown values stay unknown.
"""

import asyncio
import json
from copy import deepcopy
from itertools import combinations
from math import isfinite

AMENITIES = frozenset({"has_disabled_access", "has_baby_changing", "is_free"})
REASON_CLAIMS = {
    "free": ("is_free", True, "ücretsiz"),
    "paid": ("is_free", False, "ücretli"),
    "accessible": ("has_disabled_access", True, "engelli erişimine uygun"),
    "baby_changing": ("has_baby_changing", True, "bebek bakım ünitesine sahip"),
}
REASON_INSTRUCTIONS = (
    "SmartLoo için yalnız verilen adayları açıkla. Her candidate_ref tam bir kez "
    "bulunmalı. Her aday için allowed_claims içinden bir veya daha fazla kod seç. "
    "Kodları free, paid, accessible, baby_changing sırasına göre yaz. "
    "Cümle 'Tesis ' ile başlasın ve kesinlikle tek noktayla bitsin. Kodların "
    "karşılıkları sırasıyla 'ücretsiz', 'ücretli', 'engelli erişimine uygun', "
    "'bebek bakım ünitesine sahip'. İki karşılığı ' ve ' ile birleştir. "
    "Üç karşılıkta ilk ikisinin arasına ', ', sonuncudan önce ' ve ' koy. "
    "Verilmeyen özellik veya kişisel bilgi ekleme. Yalnız JSON şemasını döndür."
)


def _allowed_claims(facts):
    return [code for code, (field, value, _) in REASON_CLAIMS.items()
            if facts.get(field) is value]


def _claim_sentence(claims):
    clauses = [REASON_CLAIMS[code][2] for code in claims]
    if len(clauses) == 1:
        return f"Tesis {clauses[0]}."
    return f"Tesis {', '.join(clauses[:-1])} ve {clauses[-1]}."


def recommendation_reason_payload(evidence):
    if not 1 <= len(evidence) <= 3:
        raise ValueError("invalid_reason_candidate_count")
    payload = {}
    for index, facts in enumerate(evidence, 1):
        ref = f"c{index}"
        if facts.get("candidate_ref") != ref:
            raise ValueError("invalid_reason_candidate_ref")
        claims = _allowed_claims(facts)
        if not claims:
            raise ValueError("reason_candidate_without_verified_facts")
        payload[ref] = claims
    return payload


def recommendation_reason_schema(payload):
    # Constrain generation to the same finite grounded language the parser accepts.
    # Union per-candidate sentences, never cross-candidate combinations of facts;
    # the parser still verifies every ref/claim/sentence association independently.
    allowed_claims = [code for code in REASON_CLAIMS if any(code in claims for claims in payload.values())]
    sentences = sorted({_claim_sentence(group)
                        for claims in payload.values()
                        for size in range(1, len(claims) + 1)
                        for group in combinations(claims, size)})
    return {
        "type": "object", "additionalProperties": False,
        "properties": {"recommendations": {
            "type": "array", "minItems": len(payload), "maxItems": len(payload),
            "items": {"type": "object", "additionalProperties": False,
                      "properties": {
                          "candidate_ref": {"type": "string", "enum": list(payload)},
                          "claims": {"type": "array", "minItems": 1, "maxItems": 3,
                                     "items": {"type": "string", "enum": allowed_claims}},
                          "reason": {"type": "string", "enum": sentences}},
                      "required": ["candidate_ref", "claims", "reason"]},
        }},
        "required": ["recommendations"],
    }


def _unique_fields(pairs):
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise ValueError("duplicate_reason_field")
    return fields


def parse_recommendation_reasons(text, payload):
    response = json.loads(text, object_pairs_hook=_unique_fields)
    if not isinstance(response, dict) or set(response) != {"recommendations"}:
        raise ValueError("invalid_reason_response")
    rows = response["recommendations"]
    if not isinstance(rows, list) or len(rows) != len(payload):
        raise ValueError("invalid_reason_result_count")
    reasons = {}
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"candidate_ref", "claims", "reason"}:
            raise ValueError("invalid_reason_fields")
        ref, claims, reason = row["candidate_ref"], row["claims"], row["reason"]
        if not isinstance(ref, str) or ref not in payload or ref in reasons:
            raise ValueError("invalid_reason_ref")
        if not isinstance(claims, list) or not claims:
            raise ValueError("invalid_reason_claims")
        canonical = [code for code in payload[ref] if code in claims]
        if claims != canonical or reason != _claim_sentence(canonical):
            raise ValueError("unsupported_reason_claims_or_sentence")
        reasons[ref] = reason
    return reasons


async def validate_recommendation_reason(reason, facts):
    claims = _allowed_claims(facts)
    return any(reason == _claim_sentence(group)
               for size in range(1, len(claims) + 1) for group in combinations(claims, size))


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
