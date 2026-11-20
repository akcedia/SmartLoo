"""SmartLoo FastAPI application.

Nearby search, facility details and accounts use PostgreSQL/PostGIS.
Reviews use MongoDB with aggregates in PostgreSQL. Tests can inject
isolated accounts, reviews and nearby search. Other features remain pending.
"""

import time
from copy import deepcopy
from uuid import UUID

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from src.auth import PostgresAccounts, RepositoryAccounts, current_user, require_admin
from src.auth import router as auth_router
from src.nearby_store import find_nearby, find_toilet
from src.review_scores import ReviewStoreError
from src.reviews import MongoReviews, PostgresToilets, RepositoryReviews, RepositoryToilets, ReviewService
from src.reviews import router as reviews_router
from src.review_ai_coordinator import ReviewAICoordinator
from src.admin_analytics import create_analytics_router
from src import analytics_store


def create_app(state=None, ai_provider=None, jwt_secret=None, nearby_search=None):
    app = FastAPI(title="SmartLoo requirements-stage API")
    app.state.repository = deepcopy(state or {})
    app.state.ai_provider = ai_provider
    app.state.jwt_secret = jwt_secret
    app.state.nearby_search = (
        nearby_search if nearby_search is not None else find_nearby
    )
    app.state.accounts = (
        RepositoryAccounts(app.state.repository) if state is not None else PostgresAccounts()
    )
    app.state.clock = time.time
    if state is not None:
        reviews, toilets = RepositoryReviews(app.state.repository), RepositoryToilets(app.state.repository)
    else:
        reviews, toilets = MongoReviews(), PostgresToilets()
    app.state.reviews = ReviewService(reviews, toilets, app.state.accounts)
    app.state.review_ai_coordinator = ReviewAICoordinator(app.state.reviews)
    app.include_router(auth_router)
    app.include_router(reviews_router)
    app.state.analytics_read_facilities = (
        (lambda district: analytics_store.repository_facilities(app.state.repository, district))
        if state is not None else analytics_store.read_facilities
    )
    app.state.analytics_read_reviews = (
        (lambda ids, start, end: analytics_store.repository_scores(app.state.repository, ids, start, end))
        if state is not None else analytics_store.read_scores
    )
    app.include_router(create_analytics_router(
        require_admin,
        lambda district: app.state.analytics_read_facilities(district),
        lambda ids, start, end: app.state.analytics_read_reviews(ids, start, end),
        app.state.reviews.coordination.snapshot_guard,
    ))

    @app.exception_handler(psycopg.OperationalError)
    @app.exception_handler(psycopg.InterfaceError)
    @app.exception_handler(psycopg.errors.QueryCanceled)
    @app.exception_handler(psycopg.errors.LockNotAvailable)
    @app.exception_handler(ReviewStoreError)
    async def database_unavailable(request, exc):
        return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable"})

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

    @app.get("/api/v1/toilets/{toilet_id}")
    def toilet_detail(toilet_id: UUID):
        try:
            toilet = find_toilet(toilet_id)
        except (psycopg.OperationalError, psycopg.InterfaceError) as exc:
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable",
            ) from exc
        if toilet is None:
            raise HTTPException(status_code=404, detail="Toilet not found")
        return toilet

    async def pending():
        return JSONResponse(status_code=501, content={"detail": "Feature not implemented"})

    public = [
        ("/", ["GET"]),
        ("/api/v1/toilets/{toilet_id}/summary", ["GET"]),
        ("/api/v1/recommendations", ["GET"]),
    ]
    signed_in = [
        ("/api/v1/toilets/suggest", ["POST"]),
        ("/api/v1/users/me", ["DELETE"]),
    ]
    admin = [
        ("/api/v1/admin/suggestions/{suggestion_id}", ["PATCH"]),
        ("/api/v1/admin/toilets/{toilet_id}", ["PATCH"]),
        ("/api/v1/admin/import", ["POST"]),
    ]
    for routes, guard in ((public, []), (signed_in, [Depends(current_user)]),
                          (admin, [Depends(require_admin)])):
        for path, methods in routes:
            app.add_api_route(path, pending, methods=methods, dependencies=guard)
    return app
