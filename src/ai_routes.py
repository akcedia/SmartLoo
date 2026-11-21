"""Public summary route backed by the actual guarded review snapshot."""
import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from src.ai_summary_service import INSUFFICIENT

router = APIRouter(prefix="/api/v1")


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
