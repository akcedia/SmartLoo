"""Public summary route backed by the actual guarded review snapshot."""
import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Query
from src.ai_recommendations import select_candidates
from src.ai_summary_service import INSUFFICIENT

router = APIRouter(prefix="/api/v1")


@router.get("/recommendations")
def recommendations(request: Request,
                    lat: float = Query(..., ge=-90, le=90, allow_inf_nan=False),
                    lon: float = Query(..., ge=-180, le=180, allow_inf_nan=False),
                    radius: float = Query(1000, ge=1, le=50000, allow_inf_nan=False),
                    open_now: bool = False, has_disabled_access: bool | None = None,
                    has_baby_changing: bool | None = None, is_free: bool | None = None):
    rows = request.app.state.nearby_search(lat=lat, lon=lon, radius=radius, open_now=open_now,
        has_disabled_access=has_disabled_access, has_baby_changing=has_baby_changing, is_free=is_free)
    # No model/ranking claim: use Emir's selector with real search facts only.
    # Inactive or unknown-status locations remain visible in the city directory,
    # but must not be presented as suitable recommendations.
    candidates, public = [], {}
    fields = ("name", "latitude", "longitude", "district", "address", "status",
              "opening_hours", "is_open_now", "price_try", "review_count")
    for row in rows:
        if row.get("status") != "ACTIVE" or (open_now and row.get("is_open_now") is not True):
            continue
        key = str(row["id"])
        public[key] = {field: row.get(field) for field in fields}
        candidates.append({"id": key, "distance_m": float(row["distance_m"]),
            "average_cleanliness": float(row["average_cleanliness"]) if row.get("average_cleanliness") is not None else None,
            **{field: row.get(field) for field in ("has_disabled_access", "has_baby_changing", "is_free")}})
    preferences = {key: value for key, value in dict(has_disabled_access=has_disabled_access,
        has_baby_changing=has_baby_changing, is_free=is_free).items() if value is not None}
    selected = select_candidates(candidates, preferences)
    results = [{**public[row["id"]], **row} for row in selected]
    return {"results": results, "count": len(results), "ai_reasons_available": False, "fallback": True,
            "ranking_policy": "distance-first-v1",
            "message": ("AI açıklaması mevcut değil; filtrelerinize uygun tesisler mesafeye göre listeleniyor."
                        if results else "Bu bölgede filtrelerinize uygun aktif tesis bulunamadı.")}


@router.get("/toilets/{toilet_id}/summary")
async def summary(toilet_id: UUID, request: Request):
    try:
        async with asyncio.timeout(10):
            return await read_summary(str(toilet_id), request.app)
    except TimeoutError as exc:
        raise HTTPException(status_code=503, detail="Summary temporarily unavailable") from exc


async def read_summary(key, app):
    # Missing/store failure/repair are not an empty-review success. This also
    # validates the facility when no provider has been configured.
    snapshot = await app.state.review_ai_coordinator.snapshot_for_summary(key)
    if not snapshot.ready:
        raise HTTPException(status_code=503, detail="Review update or recovery in progress")
    service = getattr(app.state, "summary_service", None)
    if service is None:
        return {"summary": None,
                "message": ("Özet için en az 3 yorum gerekli." if snapshot.review_count < 3
                            else "AI özeti şu anda kullanılamıyor."),
                "review_count": snapshot.review_count,
                "average_cleanliness": snapshot.average_cleanliness}
    result = await service.summarize(key)
    if result.get("summary") is None:
        result = {**result, "message": ("Özet için en az 3 uygun yorum gerekli."
                  if result.get("message") == INSUFFICIENT else "AI özeti şu anda kullanılamıyor.")}
    return result
