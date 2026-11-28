"""Same-origin cloud entry point; the development API factory stays unchanged."""
import os
import re
import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles
from starlette.responses import Response

from src.app import create_app


class InlineScripts(HTMLParser):
    """Hash trusted generated HTML scripts without permitting arbitrary inline JS."""
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []
        self.hashes = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.active = not any(key == "src" for key, _ in attrs)
            self.parts = []

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            script = "".join(self.parts)
            if script.strip():
                digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
                self.hashes.append("'sha256-" + digest + "'")
            self.active = False


def browser_policy(hashes=(), *, documentation=False):
    return "; ".join([
        "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
        "form-action 'self'", "script-src 'self' https://cdn.jsdelivr.net " + " ".join(hashes),
        "style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com" + (" 'unsafe-inline'" if documentation else ""),
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org https://fastapi.tiangolo.com",
        "connect-src 'self'", "font-src 'self' https://fonts.gstatic.com", "frame-src 'none'",
    ])


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

    @app.middleware("http")
    async def browser_security_headers(request, call_next):
        response = await call_next(request)
        hashes = []
        if response.headers.get("content-type", "").startswith("text/html"):
            # Only generated HTML is buffered. JSON APIs and streamed exports
            # retain their normal response path and do not incur HTML parsing.
            body = b"".join([chunk async for chunk in response.body_iterator])
            parser = InlineScripts()
            parser.feed(body.decode("utf-8"))
            hashes = parser.hashes
            response = Response(body, status_code=response.status_code, headers=dict(response.headers), background=response.background)
        response.headers["Content-Security-Policy"] = browser_policy(hashes, documentation=request.url.path in {"/docs", "/redoc", "/docs/oauth2-redirect"})
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
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
