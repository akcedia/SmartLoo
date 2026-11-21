import os

import psycopg
from psycopg.rows import dict_row


def _connect():
    return psycopg.connect(
        host=os.getenv("SMARTLOO_DB_HOST", "127.0.0.1"),
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
                   CASE WHEN status IS NULL THEN NULL WHEN status = 'ACTIVE'
                        THEN opening_hours_is_open(opening_hours, now())
                        ELSE false END AS is_open_now,
                   average_cleanliness, review_count
            FROM toilets
            WHERE id = %s
            """,
            (toilet_id,),
        ).fetchone()


def find_ibb_facilities(open_now=False, has_disabled_access=None, has_baby_changing=None, is_free=None):
    """Bounded city directory; never present a truncated result as the full source."""
    with _connect() as conn:
        if not conn.execute("SELECT EXISTS(SELECT 1 FROM external_import_runs WHERE source='ibb') AS imported").fetchone()["imported"]:
            raise psycopg.OperationalError("IBB source has not been imported")
        rows = conn.execute("""
            SELECT id,name,latitude,longitude,district,address,has_disabled_access,has_baby_changing,
                   is_free,price_try,opening_hours,status,average_cleanliness,review_count,
                   CASE WHEN status IS NULL THEN NULL WHEN status='ACTIVE'
                        THEN opening_hours_is_open(opening_hours,now()) ELSE false END AS is_open_now,
                   NULL::double precision AS distance_m,
                   source_properties->>'TUVALET_DURUM' AS source_status
            FROM toilets WHERE source='ibb'
              AND (NOT %s OR (status='ACTIVE' AND opening_hours_is_open(opening_hours,now()) IS TRUE))
              AND (%s::boolean IS NULL OR has_disabled_access=%s)
              AND (%s::boolean IS NULL OR has_baby_changing=%s)
              AND (%s::boolean IS NULL OR is_free=%s)
            ORDER BY district,name,id LIMIT 2001
        """, (open_now, has_disabled_access, has_disabled_access, has_baby_changing,
              has_baby_changing, is_free, is_free)).fetchall()
    if len(rows) > 2000:
        raise psycopg.OperationalError("City directory exceeds bounded capacity")
    return rows
