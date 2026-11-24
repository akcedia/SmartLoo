"""SmartLoo FastAPI application.

Nearby search, facility details and accounts use PostgreSQL/PostGIS.
Reviews use MongoDB with aggregates in PostgreSQL. Tests can inject
isolated accounts, reviews and nearby search. Other features remain pending.
"""

import time
from contextlib import asynccontextmanager
from copy import deepcopy
from uuid import UUID

import psycopg
from anyio import CapacityLimiter, to_thread
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, Response

from src.accounts import router as accounts_router
from src.facility_admin import router as facility_admin_router
from src.suggestions import PostgresSuggestions, RepositorySuggestions
from src.suggestions import router as suggestions_router
from src.auth import PostgresAccounts, RepositoryAccounts, current_user, require_admin
from src.auth import router as auth_router
from src.nearby_store import NEARBY_READERS, create_nearby_pool, find_nearby, find_toilet, find_ibb_facilities
from src.nearby_response import NearbyResponse, encode_nearby
from src.review_scores import ReviewStoreError
from src.reviews import MongoReviews, PostgresToilets, RepositoryReviews, RepositoryToilets, ReviewService
from src.reviews import router as reviews_router
from src.review_ai_coordinator import ReviewAICoordinator
from src.admin_analytics import create_analytics_router
from src import analytics_store
from src.ai_routes import router as ai_router
from src.ai_runtime import ai_lifespan
from src.admin_import import PostgresAdminImport, RepositoryAdminImport, router as import_router


def create_app(state=None, ai_provider=None, jwt_secret=None, nearby_search=None,
               ai_cache=None, ai_profile=None, ai_reason_provider=None):
    @asynccontextmanager
    async def lifespan(app):
        pool = create_nearby_pool() if state is None and nearby_search is None else None
        app.state.nearby_pool = pool
        app.state.nearby_limiter = CapacityLimiter(NEARBY_READERS) if pool is not None else None
        try:
            async with ai_lifespan(app, provider=ai_provider, cache=ai_cache, profile=ai_profile,
                                   reason_provider=ai_reason_provider):
                yield
        finally:
            if pool is not None:
                pool.close()
            app.state.nearby_pool = None
            app.state.nearby_limiter = None
    app = FastAPI(title="SmartLoo requirements-stage API", lifespan=lifespan)
    app.state.repository = deepcopy(state or {})
    app.state.ai_provider = ai_provider
    app.state.jwt_secret = jwt_secret
    app.state.nearby_pool = None
    app.state.nearby_limiter = None

    def default_nearby_search(**kwargs):
        pool = app.state.nearby_pool
        if pool is not None:
            return find_nearby(**kwargs, connection_factory=pool.connection)
        return find_nearby(**kwargs)

    app.state.nearby_search = nearby_search if nearby_search is not None else default_nearby_search
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
    app.state.admin_import = (RepositoryAdminImport(app.state.repository, app.state.reviews.coordination)
                              if state is not None else PostgresAdminImport())
    app.include_router(auth_router)
    app.include_router(reviews_router)
    app.include_router(accounts_router)
    app.include_router(ai_router)
    app.include_router(facility_admin_router)
    app.state.suggestions = (RepositorySuggestions(app.state.repository) if state is not None
                             else PostgresSuggestions())
    app.include_router(suggestions_router)
    app.include_router(import_router)
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

    @app.get("/api/v1/toilets/nearby", response_model=NearbyResponse)
    async def nearby(
        lat: float = Query(..., ge=-90, le=90, allow_inf_nan=False),
        lon: float = Query(..., ge=-180, le=180, allow_inf_nan=False),
        radius: float = Query(1000, ge=1, le=50000, allow_inf_nan=False),
        open_now: bool = False,
        has_disabled_access: bool | None = None,
        has_baby_changing: bool | None = None,
        is_free: bool | None = None,
    ):
        def perform_search():
            rows = app.state.nearby_search(
                lat=lat,
                lon=lon,
                radius=radius,
                open_now=open_now,
                has_disabled_access=has_disabled_access,
                has_baby_changing=has_baby_changing,
                is_free=is_free,
            )
            return Response(content=encode_nearby(rows), media_type="application/json")

        try:
            return await to_thread.run_sync(perform_search, limiter=app.state.nearby_limiter)
        except (psycopg.OperationalError, psycopg.InterfaceError) as exc:
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable",
            ) from exc

    @app.get("/api/v1/toilets")
    def ibb_directory(open_now: bool = False, has_disabled_access: bool | None = None,
                      has_baby_changing: bool | None = None, is_free: bool | None = None):
        rows, coverage = find_ibb_facilities(open_now, has_disabled_access, has_baby_changing, is_free,
                                              with_filter_coverage=True)
        return {"count": len(rows), "results": rows, "filter_coverage": coverage, "source": {
            "name": "İstanbul Büyükşehir Belediyesi Açık Veri Portalı",
            "url": "https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti",
            "license": "https://data.ibb.gov.tr/license",
        }}

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
    ]
    signed_in = []
    admin = []
    for routes, guard in ((public, []), (signed_in, [Depends(current_user)]),
                          (admin, [Depends(require_admin)])):
        for path, methods in routes:
            app.add_api_route(path, pending, methods=methods, dependencies=guard)
    return app
