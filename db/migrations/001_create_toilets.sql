-- Facility store for nearby search (FR-01/02). Source: docs/analysis/data/er-data-dictionary.md §2.2.
-- Unknown amenity, price and hours values stay NULL; NULL never matches a true/false filter.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE toilet_status AS ENUM ('ACTIVE', 'CLOSED', 'MAINTENANCE');

CREATE TABLE toilets (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source              text NOT NULL CHECK (btrim(source) <> ''),
    source_id           text NOT NULL CHECK (btrim(source_id) <> ''),
    ibb_source_id       text UNIQUE,
    name                varchar(150) NOT NULL CHECK (btrim(name) <> ''),
    latitude            numeric(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude           numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location            geography(Point, 4326) NOT NULL GENERATED ALWAYS AS (
                            ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
                        ) STORED,
    district            text NOT NULL CHECK (btrim(district) <> ''),
    address             text,
    has_disabled_access boolean,
    has_baby_changing   boolean,
    is_free             boolean,
    price_try           numeric(8, 2) CHECK (price_try >= 0),
    opening_hours       text,
    status              toilet_status NOT NULL DEFAULT 'ACTIVE',
    average_cleanliness numeric(3, 2) CHECK (average_cleanliness BETWEEN 1 AND 5),
    review_count        integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT toilets_source_identity UNIQUE (source, source_id),
    CONSTRAINT toilets_free_has_no_price CHECK (NOT (is_free IS TRUE AND price_try > 0))
);

-- ST_DWithin/ST_Distance on geography use this index (REQUIREMENTS §3.1).
CREATE INDEX toilets_location_gix ON toilets USING GIST (location);

CREATE FUNCTION toilets_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER toilets_updated_at
    BEFORE UPDATE ON toilets
    FOR EACH ROW EXECUTE FUNCTION toilets_touch_updated_at();

-- Open-now in Europe/Istanbul. Proposal pending the hours format decision with Özgür:
-- understands '24/7' and one daily 'HH:MM-HH:MM' range (overnight allowed);
-- NULL or any other text is unknown and returns NULL, so open-only search excludes it.
CREATE FUNCTION opening_hours_is_open(hours text, at_ts timestamptz) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN hours IS NULL THEN NULL
        WHEN hours = '24/7' THEN TRUE
        WHEN hours ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$' THEN (
            WITH t AS (
                SELECT (at_ts AT TIME ZONE 'Europe/Istanbul')::time AS now_local,
                       split_part(hours, '-', 1)::time AS opens,
                       split_part(hours, '-', 2)::time AS closes
            )
            SELECT CASE
                WHEN opens < closes THEN now_local >= opens AND now_local < closes
                ELSE now_local >= opens OR now_local < closes
            END
            FROM t
        )
        ELSE NULL
    END
$$;
