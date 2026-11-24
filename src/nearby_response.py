"""Numeric/null-preserving public search schema, compiled by Pydantic."""
from uuid import UUID

from pydantic import TypeAdapter

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


_NEARBY_ADAPTER = TypeAdapter(NearbyResponse)


def encode_nearby(rows):
    """Validate and encode once in the existing database worker thread."""
    value = _NEARBY_ADAPTER.validate_python({"count": len(rows), "results": rows})
    return _NEARBY_ADAPTER.dump_json(value)
