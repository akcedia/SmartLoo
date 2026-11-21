"""Review-to-provider boundary for #59, FR-04 / TC-28.

Pattern redaction is deliberately only one layer. A trusted privacy_check must
approve the remaining text; unknown names/addresses cannot be found reliably by
regex. No default approval is provided. Raw reviews are never logged here.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime

_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[^\W\d_]{2,}", re.UNICODE)
_PHONE_OR_ID = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
_URL = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
_UUID = re.compile(r"\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b", re.IGNORECASE)
_SECRET = re.compile(r"\b(?:sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+)", re.IGNORECASE)
_COORDINATES = re.compile(r"(?<!\w)[+-]?\d{1,3}\.\d{3,}\s*[,;/]\s*[+-]?\d{1,3}\.\d{3,}(?!\w)")
_PATTERNS = (_EMAIL, _URL, _JWT, _UUID, _SECRET, _COORDINATES, _PHONE_OR_ID)
_REMOVED = "[kişisel bilgi çıkarıldı]"


@dataclass(frozen=True)
class ReviewText:
    id: str
    created_at: datetime
    comment: str | None
    # Include all known author names/contact/account identifiers. Store adapters
    # must supply these; unrelated free-text names require privacy_check below.
    author_identifiers: tuple[str, ...]
    visible: bool = True
    deleted: bool = False


def redact_known_identifiers(text, identifiers=()):
    """Remove known identifiers and common patterns, without claiming all PII."""
    if not isinstance(text, str):
        raise ValueError("review_text_must_be_string")
    text = unicodedata.normalize("NFC", text)
    if len(text) > 1000:
        raise ValueError("review_text_too_long")
    # Drop control characters rather than passing hidden instructions/identifiers.
    text = "".join(c for c in text if not unicodedata.category(c).startswith("C") or c in "\n\t")
    for identifier in sorted(identifiers, key=len, reverse=True):
        if not isinstance(identifier, str) or not identifier.strip():
            raise ValueError("invalid_author_identifier")
        value = unicodedata.normalize("NFC", identifier.strip())
        text = re.sub(r"(?<!\w)" + re.escape(value) + r"(?!\w)", _REMOVED, text, flags=re.IGNORECASE)
    for pattern in _PATTERNS:
        text = pattern.sub(_REMOVED, text)
    text = " ".join(text.split())
    # Empty/rating-only/PII-only reviews do not meet the textual-evidence threshold.
    meaningful = text.replace(_REMOVED, "")
    if not any(c.isalpha() for c in meaningful):
        return None
    return text


class EvidencePreparer:
    def __init__(self, *, privacy_check):
        self.privacy_check = privacy_check

    async def __call__(self, snapshot):
        reviews = snapshot.reviews
        for review in reviews:
            if not isinstance(review, ReviewText):
                raise ValueError("unadapted_review_record")
            if review.created_at.tzinfo is None or review.created_at.utcoffset() is None:
                raise ValueError("review_timestamp_requires_timezone")
        # Stable ascending ID tie-break; creation time newest first.
        ordered = sorted(reviews, key=lambda r: r.id)
        ordered.sort(key=lambda r: r.created_at, reverse=True)
        result = []
        for review in ordered:
            if review.deleted or not review.visible or review.comment is None:
                continue
            text = redact_known_identifiers(review.comment, review.author_identifiers)
            if text is None:
                continue
            # Exact True only: errors or uncertain decisions never approve text.
            if await self.privacy_check(text) is not True:
                continue
            result.append({"request_review_ref": f"r{len(result) + 1}", "text": text})
            if len(result) == 50:
                break
        return result
