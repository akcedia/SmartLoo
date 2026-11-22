"""FR-05 facility suggestions and ADMIN moderation (TC-07, TC-18).

    POST  /api/v1/toilets/suggest               signed in   -> 202 pending suggestion
    GET   /api/v1/admin/suggestions?status=...   ADMIN       -> {count, results}
    PATCH /api/v1/admin/suggestions/{id}         ADMIN       -> approved / rejected

Pending and rejected suggestions never appear in public results. Approval publishes one
ACTIVE toilet in the same transaction, with id = suggestion id, source = 'suggestion' and
source_id = suggestion id, so a repeated or concurrent decision cannot publish twice.
Unknown amenities and opening hours stay NULL. Responses carry no submitter identity.
Storage: db/migrations/008_create_suggestions.sql; tests use RepositorySuggestions.
"""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from src.auth import Principal, current_user, require_admin
from src.db import connect

FIELDS = ("name", "district", "latitude", "longitude", "has_disabled_access", "has_baby_changing", "is_free")


class AlreadyDecided(Exception):
    pass


class SuggestionIn(BaseModel):
    name: str = Field(max_length=150)
    district: str = Field(max_length=100)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    has_disabled_access: bool | None = None
    has_baby_changing: bool | None = None
    is_free: bool | None = None

    @field_validator("name", "district")
    @classmethod
    def not_blank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class DecisionIn(BaseModel):
    status: Literal["approved", "rejected"]

    @field_validator("status", mode="before")
    @classmethod
    def lower_case(cls, value):
        return value.lower() if isinstance(value, str) else value


def public(suggestion):
    return {
        "id": str(suggestion["id"]),
        "status": str(suggestion["status"]).lower(),
        **{field: suggestion.get(field) for field in FIELDS},
        "toilet_id": str(suggestion["toilet_id"]) if suggestion.get("toilet_id") else None,
        "created_at": suggestion.get("created_at"),
        "decided_at": suggestion.get("decided_at"),
    }


def as_uuid(value):
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return None


class RepositorySuggestions:
    """Isolated suggestion store over the in-memory test state; not a production database."""

    def __init__(self, repository):
        self.repository = repository
        repository.setdefault("suggestions", {})

    @property
    def items(self):  # looked up each time: tests may replace the whole dict
        return self.repository["suggestions"]

    def insert(self, user_id, data):
        suggestion = {"id": str(uuid.uuid4()), **data, "status": "PENDING", "submitted_by": user_id,
                      "moderated_by": None, "toilet_id": None,
                      "created_at": datetime.now(timezone.utc).isoformat(), "decided_at": None}
        self.items[suggestion["id"]] = suggestion
        return suggestion

    def list(self, status, limit, offset):
        rows = [dict(s, id=s.get("id", key)) for key, s in self.items.items()
                if str(s["status"]).upper() == status]
        return rows[offset:offset + limit], len(rows)

    def decide(self, suggestion_id, admin_id, decision):
        suggestion = self.items.get(suggestion_id)
        if suggestion is None:
            return None
        if str(suggestion["status"]).upper() != "PENDING":
            raise AlreadyDecided
        toilet_id = None
        if decision == "APPROVED":
            toilet_id = suggestion.get("id", suggestion_id)
            self.repository.setdefault("toilets", {})[toilet_id] = {
                "id": toilet_id, "source": "suggestion", "source_id": suggestion_id,
                **{field: suggestion.get(field) for field in FIELDS},
                "status": "ACTIVE", "opening_hours": None, "address": None, "price_try": None,
                "average_cleanliness": None, "review_count": 0, "review_version": 0,
            }
        suggestion.update(status=decision, moderated_by=admin_id, toilet_id=toilet_id,
                          decided_at=datetime.now(timezone.utc).isoformat())
        return dict(suggestion, id=suggestion.get("id", suggestion_id))


class PostgresSuggestions:
    def insert(self, user_id, data):
        with connect() as conn:
            return conn.execute(
                f"""INSERT INTO suggestions (submitted_by, {", ".join(FIELDS)})
                    VALUES (%s, {", ".join(["%s"] * len(FIELDS))}) RETURNING *""",
                (user_id, *[data[field] for field in FIELDS]),
            ).fetchone()

    def list(self, status, limit, offset):
        with connect() as conn:
            rows = conn.execute(
                "SELECT * FROM suggestions WHERE status = %s ORDER BY created_at LIMIT %s OFFSET %s",
                (status, limit, offset),
            ).fetchall()
            total = conn.execute("SELECT count(*) AS n FROM suggestions WHERE status = %s",
                                 (status,)).fetchone()["n"]
        return rows, total

    def decide(self, suggestion_id, admin_id, decision):
        key = as_uuid(suggestion_id)
        if key is None:
            return None
        with connect() as conn, conn.transaction():
            suggestion = conn.execute("SELECT * FROM suggestions WHERE id = %s FOR UPDATE", (key,)).fetchone()
            if suggestion is None:
                return None
            if suggestion["status"] != "PENDING":
                raise AlreadyDecided
            toilet_id = None
            if decision == "APPROVED":
                toilet_id = conn.execute(
                    f"""INSERT INTO toilets (id, source, source_id, status, {", ".join(FIELDS)})
                        VALUES (%s, 'suggestion', %s, 'ACTIVE', {", ".join(["%s"] * len(FIELDS))})
                        RETURNING id""",
                    (key, key, *[suggestion[field] for field in FIELDS]),
                ).fetchone()["id"]
            return conn.execute(
                """UPDATE suggestions
                   SET status = %s, moderated_by = %s, toilet_id = %s, decided_at = now()
                   WHERE id = %s RETURNING *""",
                (decision, admin_id, toilet_id, key),
            ).fetchone()


router = APIRouter(prefix="/api/v1")


@router.post("/toilets/suggest", status_code=202)
def suggest(payload: SuggestionIn, request: Request, principal: Principal = Depends(current_user)):
    return public(request.app.state.suggestions.insert(principal.sub, payload.model_dump()))


@router.get("/admin/suggestions")
def list_suggestions(request: Request, status: Literal["pending", "approved", "rejected"] = "pending",
                     limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                     admin: Principal = Depends(require_admin)):
    rows, total = request.app.state.suggestions.list(status.upper(), limit, offset)
    return {"count": total, "results": [public(row) for row in rows]}


@router.patch("/admin/suggestions/{suggestion_id}")
def decide(suggestion_id: str, decision: DecisionIn, request: Request,
           admin: Principal = Depends(require_admin)):
    try:
        suggestion = request.app.state.suggestions.decide(suggestion_id, admin.sub, decision.status.upper())
    except AlreadyDecided as exc:
        raise HTTPException(status_code=409, detail="Suggestion has already been decided") from exc
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return public(suggestion)
