-- Unknown/seasonal source state stays NULL, never silently ACTIVE/CLOSED.
ALTER TABLE toilets ALTER COLUMN status DROP NOT NULL;
ALTER TABLE toilets ADD COLUMN source_properties jsonb;
CREATE TABLE external_source_identities (
 source text NOT NULL,
 fingerprint text NOT NULL,
 toilet_id uuid NOT NULL REFERENCES toilets(id),
 identity jsonb NOT NULL,
 PRIMARY KEY (source,fingerprint)
);
CREATE INDEX external_identity_toilet_idx ON external_source_identities(toilet_id);
CREATE TABLE external_import_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL,
 resource_id text NOT NULL,
 file_sha256 text NOT NULL,
 plan_sha256 text NOT NULL,
 source_rows integer NOT NULL,
 unique_rows integer NOT NULL,
 duplicate_rows integer NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION nearby_toilets(
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
           CASE WHEN t.status IS NULL THEN NULL WHEN t.status = 'ACTIVE' THEN opening_hours_is_open(t.opening_hours, p_at)
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
