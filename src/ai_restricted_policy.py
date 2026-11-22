"""Opt-in restricted Turkish evidence policy; NOT general NLP/PII detection.

Only complete, enumerated factual clauses are accepted. Unknown wording,
questions, instructions, identifiers and redaction markers reject the input.
Output must use the exact controlled rendering supported by those facts.
This profile deliberately trades coverage for inspectable decisions. It is not
an automatically enabled/approved production policy or full TC-28 acceptance.
"""

import json
import re
import unicodedata

from src.ai_evidence import EvidencePreparer
from src.ai_output import SummaryOutputValidator, validate_summary_schema

PROFILE_NAME = "restricted-tr-evidence-v1"
POLICY_VERSION = "restricted-tr-evidence-v2"
FACETS = ("cleanliness", "odor", "soap", "paper", "water", "accessibility", "lighting")
GROUPS = {"cleanliness": ("cleanliness",), "odor": ("odor",),
          "supplies": ("soap", "paper", "water"),
          "accessibility": ("accessibility",), "safety": ("lighting",)}

# Whole-clause matches only. In particular, 'temiz' is never a substring rule.
CLAUSES = {}
for facet, state, phrases in (
    ("cleanliness", "positive", ("temiz", "temizdi", "genel olarak temiz", "genel olarak temizdi", "içerisi gayet temizdi")),
    ("cleanliness", "negative", ("kirli", "kirliydi", "temiz değil", "temiz değildi")),
    ("odor", "positive", ("koku yok", "koku yoktu", "kötü koku yok", "kötü koku yoktu")),
    ("odor", "negative", ("kötü koku var", "kötü koku vardı", "kötü kokuyordu")),
    ("soap", "positive", ("sabun var", "sabun vardı")),
    ("soap", "negative", ("sabun yok", "sabun yoktu", "sabun eksik", "sabun eksikti", "lavaboda sabun kalmamıştı")),
    ("paper", "positive", ("tuvalet kâğıdı var", "tuvalet kâğıdı vardı")),
    ("paper", "negative", ("tuvalet kâğıdı yok", "tuvalet kâğıdı yoktu", "tuvalet kâğıdı eksik")),
    ("water", "positive", ("su var", "su vardı")),
    ("water", "negative", ("su yok", "su yoktu", "su eksik")),
    ("accessibility", "positive", ("engelli erişimi vardı", "engelli erişimi var")),
    ("accessibility", "negative", ("engelli erişimi yoktu", "engelli erişimi yok")),
    ("lighting", "positive", ("aydınlatma iyiydi", "aydınlatma iyi")),
    ("lighting", "negative", ("aydınlatma yetersizdi", "aydınlatma yetersiz", "içerisi karanlıktı")),
):
    for phrase in phrases:
        CLAUSES[phrase] = (facet, state)

PHRASES = {
    "cleanliness": {"positive": "Temiz", "negative": "Kirli", "mixed": "Temizlik hakkında çelişkili yorumlar var"},
    "odor": {"positive": "Kötü koku bildirilmiyor", "negative": "Kötü koku bildiriliyor", "mixed": "Koku hakkında çelişkili yorumlar var"},
    "soap": {"positive": "Sabun var", "negative": "Sabun eksik", "mixed": "Sabun hakkında çelişkili yorumlar var"},
    "paper": {"positive": "Tuvalet kâğıdı var", "negative": "Tuvalet kâğıdı eksik", "mixed": "Tuvalet kâğıdı hakkında çelişkili yorumlar var"},
    "water": {"positive": "Su var", "negative": "Su eksik", "mixed": "Su hakkında çelişkili yorumlar var"},
    "accessibility": {"positive": "Erişilebilirlik olumlu bildiriliyor", "negative": "Erişilebilirlik sorunu bildiriliyor", "mixed": "Erişilebilirlik hakkında çelişkili yorumlar var"},
    # Only lighting observations; never a safety inspection/certification.
    "lighting": {"positive": "Aydınlatma olumlu bildiriliyor", "negative": "Aydınlatma yetersiz bildiriliyor", "mixed": "Aydınlatma hakkında çelişkili yorumlar var"},
}

RESTRICTED_PROMPT_VERSION = "restricted-prompt-v3"


def restricted_summary_instructions():
    """Describe the validator's exact vocabulary and rendering to the model."""
    vocabulary = {}
    for facet in FACETS:
        vocabulary[facet] = {
            "input": {state: [clause for clause, fact in CLAUSES.items()
                              if fact == (facet, state)]
                      for state in ("positive", "negative")},
            "output": PHRASES[facet],
        }
    rules = (
        "Aşağıdaki sözlük ve biçim kuralları bu dar Türkçe profil için bağlayıcıdır. "
        "Yorumları noktalama ve ama, ancak, fakat, ve bağlaçlarından böl. "
        "Her tam ifadeyi Türkçe büyük/küçük harfleri gözeterek input karşılığıyla eşleştir. "
        "Her gözlem alanında yalnız olumlu veya olumsuz kanıt varsa o durumu, "
        "ikisi varsa mixed, hiç kanıt yoksa unknown kullan. Çoğunluk çelişkiyi gidermez. "
        "summary için alanları sözlük sırasıyla işle. unknown alanları atla. "
        "Her alan için output ifadesini aynen kullan. İlk ifade büyük harfle başlar. "
        "Sonraki ifadelerin ilk harfini Türkçe kurallarla küçült. "
        "Bir önceki yazılan alan positive ve sıradaki negative ise ', ancak ', "
        "diğer geçişlerde '; ' kullan. Sona tek nokta koy. Yeniden ifade etme. "
        "pros için positive, cons için negative alanların output ifadelerini özgün "
        "baş harfleriyle ve sonda noktayla yaz. Her listede sözlük sırasındaki "
        "ilk üç ifadeyi kullan. mixed ve unknown bu listelere girmez. "
        "categories için aşağıdaki gruplarda bulunan ham olumlu ve olumsuz "
        "kanıtları birleştir ve aynı durum kurallarını uygula. safety sadece "
        "aydınlatma gözlemini gösterir. cleanliness ya da odor negative ise "
        "recommendation=avoid. cleanliness positive ve hiçbir alan negative "
        "ya da mixed değilse recommended. Diğer durumlarda acceptable. "
        "Örneğin temizlik positive ve sabun negative ise özet aynen "
        "'Temiz, ancak sabun eksik.' olur."
    )
    return (f"{rules}\nSözlük: {json.dumps(vocabulary, ensure_ascii=False)}"
            f"\nKategori grupları: {json.dumps(GROUPS)}")


def _lower(text):
    return text.translate(str.maketrans({"I": "ı", "İ": "i"})).lower()


def _normalize(text):
    if not isinstance(text, str) or not text.strip() or len(text) > 1000:
        raise ValueError("restricted_text_not_supported")
    text = unicodedata.normalize("NFC", text)
    if any(unicodedata.category(c).startswith("C") for c in text):
        raise ValueError("restricted_control_character")
    return " ".join(text.split())


def facts_from_text(text):
    text = _normalize(text)
    if "?" in text:
        raise ValueError("restricted_question_not_evidence")
    clauses = [s.strip() for s in re.split(r"[.!;,]|\b(?:ama|ancak|fakat|ve)\b", _lower(text)) if s.strip()]
    if not clauses or any(clause not in CLAUSES for clause in clauses):
        raise ValueError("restricted_clause_not_supported")
    return {CLAUSES[clause] for clause in clauses}


def evidence_facts(evidence):
    if not isinstance(evidence, list) or not 3 <= len(evidence) <= 50:
        raise ValueError("restricted_evidence_count")
    refs, facts = set(), set()
    for row in evidence:
        if not isinstance(row, dict) or set(row) != {"request_review_ref", "text"}:
            raise ValueError("restricted_evidence_fields")
        ref = row["request_review_ref"]
        if not isinstance(ref, str) or not re.fullmatch(r"r[1-9][0-9]*", ref) or ref in refs:
            raise ValueError("restricted_evidence_refs")
        refs.add(ref)
        facts.update(facts_from_text(row["text"]))
    return facts


def _state(values):
    if not values:
        return "unknown"
    return next(iter(values)) if len(values) == 1 else "mixed"


def _render(facts):
    states = {facet: _state({state for f, state in facts if f == facet}) for facet in FACETS}
    parts, pros, cons = [], [], []
    previous = None
    for facet in FACETS:
        state = states[facet]
        if state == "unknown":
            continue
        phrase = PHRASES[facet][state]
        if not parts:
            parts.append(phrase)
        else:
            parts.append((", ancak " if previous == "positive" and state == "negative" else "; ") + _lower(phrase[0]) + phrase[1:])
        if state == "positive":
            pros.append(phrase + ".")
        elif state == "negative":
            cons.append(phrase + ".")
        previous = state
    summary = "".join(parts) + "."
    if not parts or len(summary) > 400:
        raise ValueError("restricted_summary_not_renderable")
    categories = {category: _state({s for f, s in facts if f in facets}) for category, facets in GROUPS.items()}
    # Explicit review proposal, not weights mandated by FR-04.
    if states["cleanliness"] == "negative" or states["odor"] == "negative":
        recommendation = "avoid"
    elif states["cleanliness"] == "positive" and not any(s in ("negative", "mixed") for s in states.values()):
        recommendation = "recommended"
    else:
        recommendation = "acceptable"
    return {"summary": summary, "pros": pros, "cons": cons,
            "categories": categories, "recommendation": recommendation}


def expected_candidate(evidence):
    """Controlled candidate for a fixture/demo, not an AI model implementation."""
    value = _render(evidence_facts(evidence))
    return {**value, "pros": value["pros"][:3], "cons": value["cons"][:3]}


async def restricted_input_check(text):
    try:
        return bool(facts_from_text(text))
    except ValueError:
        return False


async def restricted_output_check(text):
    """Finite Turkish phrase grammar; not a general language or PII detector."""
    try:
        text = _normalize(text)
    except ValueError:
        return False
    if not text.endswith("."):
        return False
    pieces = re.split(r"; |, ancak ", text[:-1])
    allowed = {_lower(phrase) for values in PHRASES.values() for phrase in values.values()}
    return bool(pieces) and all(_lower(piece) in allowed for piece in pieces)


async def restricted_grounding_check(candidate, evidence):
    try:
        output = validate_summary_schema(candidate)
        expected = _render(evidence_facts(evidence))
    except ValueError:
        return False
    if any(output[field] != expected[field] for field in ("summary", "categories", "recommendation")):
        return False
    return all(len(values := output[field]) == len(set(values)) and set(values) <= set(expected[field])
               for field in ("pros", "cons"))


def restricted_preparer():
    return EvidencePreparer(privacy_check=restricted_input_check)


def restricted_validator():
    return SummaryOutputValidator(language_check=restricted_output_check,
        privacy_check=restricted_output_check, grounding_check=restricted_grounding_check)
