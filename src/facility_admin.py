"""FR-10/TC-27: PATCH /api/v1/admin/toilets/{toilet_id} — ADMIN facility status.

A reviewed facility is closed, never hard-deleted (REQ-DB-04). Closing keeps every
review and the aggregates; new reviews are refused with 404 and nearby search with
open_now=true excludes it. review_version moves so stale AI summaries are not reused.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, field_validator

from src.auth import Principal, require_admin

router = APIRouter(prefix="/api/v1/admin")


class FacilityStatusIn(BaseModel):
    status: Literal["ACTIVE", "CLOSED", "MAINTENANCE"]

    @field_validator("status", mode="before")
    @classmethod
    def upper_case(cls, value):
        return value.upper() if isinstance(value, str) else value


@router.patch("/toilets/{toilet_id}")
def update_facility_status(toilet_id: str, change: FacilityStatusIn, request: Request,
                           admin: Principal = Depends(require_admin)):
    return request.app.state.reviews.set_facility_status(toilet_id, change.status)
