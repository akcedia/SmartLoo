"""Same-origin cloud entry point; the development API factory stays unchanged."""
import os
import re
from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles

from src.app import create_app


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            # Only known browser routes receive index.html. API and missing asset
            # errors must retain their status instead of becoming successful HTML.
            route = path.replace("\\", "/").strip("/")
            is_page = route in {"sign-in", "register", "account", "suggest", "admin"} or route.startswith("admin/")
            if exc.status_code != 404 or not is_page or scope["method"] not in {"GET", "HEAD"}:
                raise
            return await super().get_response("index.html", scope)


def create_cloud_app(web_dir=None, **app_options):
    directory = Path(web_dir or os.getenv("SMARTLOO_WEB_DIR", "/app/web"))
    if not (directory / "index.html").is_file():
        raise RuntimeError("Built frontend index.html is missing")
    app = create_app(**app_options)
    # The API-only factory has a placeholder GET /. Replace it only in this
    # cloud composition so the frontend owns the public home page.
    app.router.routes = [route for route in app.router.routes if getattr(route, "path", None) != "/"]

    @app.get("/healthz", include_in_schema=False)
    def health():
        # Process liveness only; datastore acceptance is tested separately.
        result = {"status": "ok"}
        revision = os.getenv("RENDER_GIT_COMMIT", "")
        if re.fullmatch(r"[0-9a-f]{40}", revision):
            result["revision"] = revision
        return result

    app.mount("/", FrontendFiles(directory=directory, html=True), name="frontend")
    return app
