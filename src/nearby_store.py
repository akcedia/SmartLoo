import os

import psycopg
from psycopg.rows import dict_row


def find_nearby(
    lat,
    lon,
    radius=1000,
    open_now=False,
    has_disabled_access=None,
    has_baby_changing=None,
    is_free=None,
):
    with psycopg.connect(
        host=os.getenv("SMARTLOO_DB_HOST", "localhost"),
        port=int(os.getenv("SMARTLOO_DB_PORT", "5432")),
        dbname=os.getenv("SMARTLOO_DB_NAME", "smartloo"),
        user=os.getenv("SMARTLOO_DB_USER", "smartloo"),
        password=os.getenv("SMARTLOO_DB_PASSWORD", "smartloo-dev-only"),
        connect_timeout=5,
        row_factory=dict_row,
    ) as conn:
        rows = conn.execute(
            """
            SELECT * FROM nearby_toilets(
                p_lat => %s,
                p_lon => %s,
                p_radius_m => %s,
                p_open_now => %s,
                p_has_disabled_access => %s,
                p_has_baby_changing => %s,
                p_is_free => %s
            )
            """,
            (
                lat,
                lon,
                radius,
                open_now,
                has_disabled_access,
                has_baby_changing,
                is_free,
            ),
        ).fetchall()

    return rows