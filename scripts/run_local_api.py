"""Start the local API with a persistent, ignored signing key; never log secrets."""
import argparse
import os
from pathlib import Path
import secrets
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def signing_key(path):
    configured = os.getenv("SMARTLOO_JWT_SECRET")
    if configured:
        if len(configured.encode()) < 32:
            raise ValueError("SMARTLOO_JWT_SECRET must contain at least 32 bytes")
        return configured
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8") as output:
            output.write(secrets.token_urlsafe(48))
    except FileExistsError:
        pass
    value = path.read_text(encoding="utf-8").strip()
    if len(value.encode()) < 32:
        raise ValueError("Local signing key is invalid")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db-port", type=int)
    parser.add_argument("--mongo-url")
    args = parser.parse_args()
    if args.db_port:
        os.environ["SMARTLOO_DB_PORT"] = str(args.db_port)
    if args.mongo_url:
        os.environ["SMARTLOO_MONGO_URL"] = args.mongo_url
    os.environ["SMARTLOO_JWT_SECRET"] = signing_key(ROOT / ".venv" / "local-jwt-secret")
    import uvicorn
    uvicorn.run("src.app:create_app", factory=True, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
