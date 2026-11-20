"""Opt-in mounted React/FastAPI check against an existing migrated test database.

Run with SMARTLOO_TEST_POSTGIS=1, SMARTLOO_TEST_MONGO=1 and the usual DB/Mongo
connection variables. Requires frontend npm ci. Provisions only a private facility,
three accounts and a unique Mongo database; removes them in finally.
"""
import os
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


def main():
    if os.getenv("SMARTLOO_TEST_POSTGIS") != "1" or os.getenv("SMARTLOO_TEST_MONGO") != "1":
        raise SystemExit("Explicit test database opt-in required")
    import pymongo
    import uvicorn
    from fastapi.testclient import TestClient
    from src.db import connect

    marker = uuid.uuid4().hex
    facility = str(uuid.uuid4())
    mongo_db = f"smartloo_map_test_{marker}"
    original_mongo_db = os.environ.get("SMARTLOO_MONGO_DB")
    os.environ["SMARTLOO_MONGO_DB"] = mongo_db
    from src.app import create_app

    app = create_app(jwt_secret="map-live-check-only-signing-key-at-least-32-bytes")
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
        command = [npm, "test", "--", "src/features/map/reviewSession.test.jsx"]
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
        with connect() as conn:
            conn.execute("DELETE FROM review_operations WHERE toilet_id = %s", (facility,))
            conn.execute("DELETE FROM toilets WHERE id = %s AND source_id = %s", (facility, marker))
            conn.execute("DELETE FROM users WHERE email = ANY(%s)", (emails,))
        if original_mongo_db is None:
            os.environ.pop("SMARTLOO_MONGO_DB", None)
        else:
            os.environ["SMARTLOO_MONGO_DB"] = original_mongo_db


if __name__ == "__main__":
    raise SystemExit(main())
