"""SmartLoo FastAPI application.

Nearby search uses PostgreSQL/PostGIS by default.
Tests can explicitly inject an isolated search provider.
Other feature routes remain pending and return 501.
"""

from copy import deepcopy

import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from src.nearby_store import find_nearby


def create_app(state=None, ai_provider=None, jwt_secret=None, nearby_search=None):
    app = FastAPI(title="SmartLoo requirements-stage API")
    app.state.repository = deepcopy(state or {})
    app.state.ai_provider = ai_provider
    app.state.jwt_secret = jwt_secret
    app.state.nearby_search = (
        nearby_search if nearby_search is not None else find_nearby
    )

    @app.get("/api/v1/toilets/nearby")
    def nearby(
        lat: float = Query(..., ge=-90, le=90, allow_inf_nan=False),
        lon: float = Query(..., ge=-180, le=180, allow_inf_nan=False),
        radius: float = Query(1000, ge=1, le=50000, allow_inf_nan=False),
        open_now: bool = False,
        has_disabled_access: bool | None = None,
        has_baby_changing: bool | None = None,
        is_free: bool | None = None,
    ):
        try:
            rows = app.state.nearby_search(
                lat=lat,
                lon=lon,
                radius=radius,
                open_now=open_now,
                has_disabled_access=has_disabled_access,
                has_baby_changing=has_baby_changing,
                is_free=is_free,
            )
        except (psycopg.OperationalError, psycopg.InterfaceError) as exc:
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable",
            ) from exc

        return {"count": len(rows), "results": rows}

    async def pending():
        return JSONResponse(status_code=501, content={"detail": "Feature not implemented"})

    routes = [
        ("/", ["GET"]),
        ("/api/v1/toilets/suggest", ["POST"]),
        ("/api/v1/toilets/{toilet_id}", ["GET"]),
        ("/api/v1/toilets/{toilet_id}/reviews", ["GET", "POST"]),
        ("/api/v1/toilets/{toilet_id}/summary", ["GET"]),
        ("/api/v1/reviews/{review_id}", ["PATCH", "DELETE"]),
        ("/api/v1/recommendations", ["GET"]),
        ("/api/v1/auth/register", ["POST"]),
        ("/api/v1/auth/login", ["POST"]),
        ("/api/v1/users/me", ["DELETE"]),
        ("/api/v1/admin/suggestions/{suggestion_id}", ["PATCH"]),
        ("/api/v1/admin/toilets/{toilet_id}", ["PATCH"]),
        ("/api/v1/admin/metrics/summary", ["GET"]),
        ("/api/v1/admin/import", ["POST"]),
        ("/api/v1/admin/analytics/export", ["GET"]),
    ]
    for path, methods in routes:
        app.add_api_route(path, pending, methods=methods)
    return app
