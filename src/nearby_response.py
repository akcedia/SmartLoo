"""Numeric/null-preserving public search schema, compiled by Pydantic."""
from uuid import UUID

from typing_extensions import TypedDict


class NearbyToilet(TypedDict, total=False):
    id: UUID | str
    name: str
    latitude: float
    longitude: float
    district: str | None
    address: str | None
    has_disabled_access: bool | None
    has_baby_changing: bool | None
    is_free: bool | None
    price_try: float | None
    opening_hours: str | None
    status: str | None
    is_open_now: bool | None
    average_cleanliness: float | None
    review_count: int
    distance_m: float


class NearbyResponse(TypedDict):
    count: int
    results: list[NearbyToilet]
