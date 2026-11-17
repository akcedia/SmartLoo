import os

import psycopg
from psycopg.rows import dict_row


def _connect():
    return psycopg.connect(
        host=os.getenv("SMARTLOO_DB_HOST", "localhost"),
        port=int(os.getenv("SMARTLOO_DB_PORT", "5432")),
        dbname=os.getenv("SMARTLOO_DB_NAME", "smartloo"),
        user=os.getenv("SMARTLOO_DB_USER", "smartloo"),
        password=os.getenv("SMARTLOO_DB_PASSWORD", "smartloo-dev-only"),
        connect_timeout=5,
        row_factory=dict_row,
    )


def find_nearby(
    lat,
    lon,
    radius=1000,
    open_now=False,
    has_disabled_access=None,
    has_baby_changing=None,
    is_free=None,
):
    with _connect() as conn:
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


def find_toilet(toilet_id):
    with _connect() as conn:
        return conn.execute(
            """
            SELECT id, name, latitude, longitude, district, address,
                   has_disabled_access, has_baby_changing, is_free, price_try,
                   opening_hours, status,
                   CASE WHEN status = 'ACTIVE'
                        THEN opening_hours_is_open(opening_hours, now())
                        ELSE false END AS is_open_now,
                   average_cleanliness, review_count
            FROM toilets
            WHERE id = %s
            """,
            (toilet_id,),
        ).fetchone()
