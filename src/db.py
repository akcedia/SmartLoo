import os

import psycopg
from psycopg.rows import dict_row


def connect():
    """Open a PostgreSQL connection from the SMARTLOO_DB_* environment (local Docker defaults)."""
    return psycopg.connect(
        host=os.getenv("SMARTLOO_DB_HOST", "localhost"),
        port=int(os.getenv("SMARTLOO_DB_PORT", "5432")),
        dbname=os.getenv("SMARTLOO_DB_NAME", "smartloo"),
        user=os.getenv("SMARTLOO_DB_USER", "smartloo"),
        password=os.getenv("SMARTLOO_DB_PASSWORD", "smartloo-dev-only"),
        connect_timeout=5,
        row_factory=dict_row,
    )
