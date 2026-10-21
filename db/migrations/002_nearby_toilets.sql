-- Nearby search recipe for GET /api/v1/toilets/nearby (FR-01/02, REQUIREMENTS §3.1-3.2).
-- Proposal to agree with Özgür: the backend may call this function or inline the same SQL.
-- Input validation (lat/lon ranges, radius 1..50000, default 1000) stays in the API layer (422).
-- Amenity filters: NULL = no constraint; true/false match only known values (unknown never matches).
-- open_now = true keeps only ACTIVE rows whose hours are known and open at at_ts (Europe/Istanbul).

CREATE FUNCTION nearby_toilets(
    p_lat                 double precision,
    p_lon                 double precision,
    p_radius_m            double precision,
    p_open_now            boolean DEFAULT false,
    p_has_disabled_access boolean DEFAULT NULL,
    p_has_baby_changing   boolean DEFAULT NULL,
    p_is_free             boolean DEFAULT NULL,
    p_at                  timestamptz DEFAULT now()
)
RETURNS TABLE (
    id                  uuid,
    name                varchar,
    latitude            numeric,
    longitude           numeric,
    district            text,
    address             text,
    has_disabled_access boolean,
    has_baby_changing   boolean,
    is_free             boolean,
    price_try           numeric,
    opening_hours       text,
    status              toilet_status,
    is_open_now         boolean,
    average_cleanliness numeric,
    review_count        integer,
    distance_m          double precision
)
LANGUAGE sql STABLE AS $$
    WITH origin AS (
        SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography AS g
    )
    SELECT t.id, t.name, t.latitude, t.longitude, t.district, t.address,
           t.has_disabled_access, t.has_baby_changing, t.is_free, t.price_try,
           t.opening_hours, t.status,
           CASE WHEN t.status = 'ACTIVE' THEN opening_hours_is_open(t.opening_hours, p_at)
                ELSE false END AS is_open_now,
           t.average_cleanliness, t.review_count,
           ST_Distance(t.location, o.g) AS distance_m
    FROM toilets t, origin o
    WHERE ST_DWithin(t.location, o.g, p_radius_m)
      AND (p_has_disabled_access IS NULL OR t.has_disabled_access = p_has_disabled_access)
      AND (p_has_baby_changing   IS NULL OR t.has_baby_changing   = p_has_baby_changing)
      AND (p_is_free             IS NULL OR t.is_free             = p_is_free)
      AND (NOT p_open_now OR (t.status = 'ACTIVE'
                              AND opening_hours_is_open(t.opening_hours, p_at) IS TRUE))
    ORDER BY distance_m, t.id
$$;
