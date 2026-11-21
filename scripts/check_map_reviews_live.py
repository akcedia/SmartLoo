"""Opt-in mounted React/FastAPI check against an existing migrated test database.

Run with SMARTLOO_TEST_POSTGIS=1, SMARTLOO_TEST_MONGO=1 and the usual DB/Mongo
connection variables. Requires frontend npm ci. Provisions only a private facility,
three accounts and a unique Mongo database; removes them in finally.
"""
import os
import argparse
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from threading import Thread
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main(suite="reviews"):
    if os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1":
        raise SystemExit("Explicit test database opt-in required")
    import pymongo
    import uvicorn
    from fastapi.testclient import TestClient
    from src.db import connect

    marker = uuid.uuid4().hex
    facility = str(uuid.uuid4())
    facility_ids = [facility]
    mongo_db = f"smartloo_map_test_{marker}"
    original_mongo_db = os.environ.get("SMARTLOO_MONGO_DB")
    os.environ["SMARTLOO_MONGO_DB"] = mongo_db
    from src.app import create_app

    original_redis_url = os.environ.get("SMARTLOO_REDIS_URL")
    options = {}
    if suite == "ai":
        if not os.getenv("SMARTLOO_AI_TEST_REDIS_URL"):
            raise SystemExit("Explicit test Redis URL required")
        from src.ai_restricted_policy import POLICY_VERSION, expected_candidate
        async def synthetic_provider(evidence):
            return expected_candidate(evidence)
        os.environ["SMARTLOO_REDIS_URL"] = os.environ["SMARTLOO_AI_TEST_REDIS_URL"]
        options = dict(ai_provider=synthetic_provider, ai_profile=POLICY_VERSION)
    app = create_app(jwt_secret="map-live-check-only-signing-key-at-least-32-bytes", **options)
    emails = []
    server = None
    thread = None
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    try:
        with connect() as conn:
            conn.execute("""INSERT INTO toilets
                (id, source, source_id, name, latitude, longitude, district, opening_hours)
                VALUES (%s, 'map-live-test', %s, 'Map review test', 41, 29, 'Kadıköy', '24/7')""",
                (facility, marker))
        env = dict(os.environ, SMARTLOO_LIVE_ORIGIN=f"http://127.0.0.1:{port}", SMARTLOO_LIVE_TOILET=facility)
        with TestClient(app) as client:
            for role in ("OWNER", "OTHER", "ADMIN"):
                email = f"map-{role.lower()}-{marker}@example.com"
                emails.append(email)
                registered = client.post("/api/v1/auth/register", json={
                    "email": email, "password": "Guvenli123", "display_name": role,
                })
                assert registered.status_code == 201, registered.text
                if role == "ADMIN":
                    with connect() as conn:
                        conn.execute("UPDATE users SET role = 'ADMIN' WHERE email = %s", (email,))
                login = client.post("/api/v1/auth/login", json={"email": email, "password": "Guvenli123"})
                assert login.status_code == 200, login.text
                env[f"SMARTLOO_LIVE_{role}"] = login.json()["access_token"]
                env[f"SMARTLOO_LIVE_{role}_EMAIL"] = email
                if suite == "deletion" and role == "OTHER":
                    # A committed pending creation must block deletion, even
                    # before Mongo contains a document with this author.
                    blocked = str(uuid.uuid4())
                    facility_ids.append(blocked)
                    with connect() as conn:
                        conn.execute("""INSERT INTO toilets
                            (id, source, source_id, name, latitude, longitude, district)
                            VALUES (%s, 'map-live-test', %s, 'Pending review test', 41, 29, 'Kadıköy')""",
                            (blocked, marker + "-pending"))
                    with app.state.reviews.coordination.guard(blocked) as pending:
                        pending.begin(str(uuid.uuid4()), None, author_id=registered.json()["id"])
        server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        for _ in range(100):
            if server.started:
                break
            if not thread.is_alive():
                raise RuntimeError("Test API failed to start")
            time.sleep(.05)
        else:
            raise RuntimeError("Test API startup timed out")
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise RuntimeError("npm is required")
        configs = {"analytics": "vitest.admin-live.config.js", "deletion": "vitest.deletion-live.config.js",
                   "ai": "vitest.ai-live.config.js"}
        command = ([npm, "test", "--", "--config", configs[suite]] if suite in configs
                   else [npm, "test", "--", "src/features/map/reviewSession.test.jsx"])
        if env.get("SMARTLOO_MAP_JUNIT"):
            command.extend(["--reporter=default", "--reporter=junit", f"--outputFile={env['SMARTLOO_MAP_JUNIT']}"])
        result = subprocess.run(command,
                                cwd=ROOT / "frontend", env=env, timeout=90)
        return result.returncode
    finally:
        if server:
            server.should_exit = True
        if thread:
            thread.join(timeout=10)
        listener.close()
        with pymongo.MongoClient(os.getenv("SMARTLOO_MONGO_URL", "mongodb://127.0.0.1:27017")) as mongo:
            mongo.drop_database(mongo_db)
        redis_failure = None
        if suite == "ai":
            import redis
            try:
                with redis.Redis.from_url(os.environ["SMARTLOO_AI_TEST_REDIS_URL"], decode_responses=True,
                                         socket_connect_timeout=1, socket_timeout=1) as cache:
                    for key in cache.scan_iter(match=f"smartloo:summary:*{facility}*"):
                        cache.delete(key)
            except Exception as exc:
                redis_failure = exc  # Still remove SQL accounts/facilities below.
        if original_redis_url is None:
            os.environ.pop("SMARTLOO_REDIS_URL", None)
        else:
            os.environ["SMARTLOO_REDIS_URL"] = original_redis_url
        with connect() as conn:
            conn.execute("DELETE FROM review_operations WHERE toilet_id = ANY(%s::uuid[])", (facility_ids,))
            conn.execute("DELETE FROM toilets WHERE id = ANY(%s::uuid[]) AND source = 'map-live-test'", (facility_ids,))
            conn.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))
            conn.execute("DELETE FROM login_failures WHERE email = ANY(%s)", (emails,))
        if original_mongo_db is None:
            os.environ.pop("SMARTLOO_MONGO_DB", None)
        else:
            os.environ["SMARTLOO_MONGO_DB"] = original_mongo_db
        if redis_failure is not None:
            raise RuntimeError("Test Redis cleanup failed") from redis_failure


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=("reviews", "analytics", "deletion", "ai"), default="reviews")
    raise SystemExit(main(parser.parse_args().suite))
