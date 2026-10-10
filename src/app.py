"""Requirements-stage FastAPI application: routes exist, features are pending.

state is an isolated repository double for tests, not a production database.
The API never reads test expectations or returns fabricated successful results.
Replace each 501 handler with real behavior during the TDD green stage.
"""
from copy import deepcopy
from fastapi import FastAPI
from fastapi.responses import JSONResponse


def create_app(state=None, ai_provider=None, jwt_secret=None):
    app = FastAPI(title="SmartLoo requirements-stage API")
    app.state.repository = deepcopy(state or {})
    app.state.ai_provider = ai_provider
    app.state.jwt_secret = jwt_secret

    async def pending():
        return JSONResponse(status_code=501, content={"detail": "Feature not implemented"})

    routes = [
        ("/", ["GET"]),
        ("/api/v1/toilets/nearby", ["GET"]),
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
