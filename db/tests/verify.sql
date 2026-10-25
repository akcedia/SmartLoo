-- Checks the facility store on real PostGIS after migrate + seed. Any failure stops psql with an error.
-- Contract checks mirror TC-01/02/03/12/13/14 in tests/test_requirements.py (origin 41, 29).
\set ON_ERROR_STOP on
\pset footer off

\echo '== seed size and idempotency'
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM toilets WHERE source = 'fixture') = 4, 'contract set must have 4 rows';
    ASSERT (SELECT count(*) FROM toilets WHERE source = 'synthetic') = 9, 'edge set must have 9 rows';
    ASSERT (SELECT count(*) FROM toilets) = (SELECT count(DISTINCT (source, source_id)) FROM toilets),
        'duplicate import identity';
END $$;

\echo '== TC-01 nearby open, ordered by distance'
DO $$
DECLARE r record; got uuid[]; d float8[];
BEGIN
    SELECT array_agg(id ORDER BY distance_m), array_agg(distance_m ORDER BY distance_m) INTO got, d
    FROM nearby_toilets(41, 29, 1000, p_open_now => true);
    ASSERT got = ARRAY['00000000-0000-4000-8000-000000000001',
                       '00000000-0000-4000-8000-000000000002']::uuid[], format('TC-01 ids %s', got);
    ASSERT abs(d[1] - 111) <= 3, format('TC-01 A distance %s', d[1]);
    ASSERT abs(d[2] - 444) <= 5, format('TC-01 B distance %s', d[2]);
END $$;

\echo '== TC-02 accessibility filter (D unknown)'
BEGIN;
UPDATE toilets SET has_disabled_access = NULL WHERE id = '00000000-0000-4000-8000-000000000004';
DO $$
BEGIN
    ASSERT (SELECT array_agg(id ORDER BY id) FROM nearby_toilets(41, 29, 5000, p_has_disabled_access => true))
         = ARRAY['00000000-0000-4000-8000-000000000001',
                 '00000000-0000-4000-8000-000000000003']::uuid[], 'TC-02';
END $$;
ROLLBACK;

\echo '== TC-03 / TC-12 / TC-13 amenity filters'
DO $$
BEGIN
    ASSERT (SELECT array_agg(id ORDER BY id) FROM nearby_toilets(41, 29, 1000, p_has_baby_changing => true))
         = ARRAY['00000000-0000-4000-8000-000000000001',
                 '00000000-0000-4000-8000-000000000002']::uuid[], 'TC-03';
    ASSERT (SELECT array_agg(id) FROM nearby_toilets(41, 29, 1000, p_has_disabled_access => true,
                                                     p_has_baby_changing => true))
         = ARRAY['00000000-0000-4000-8000-000000000001']::uuid[], 'TC-12 filtered';
    ASSERT (SELECT array_agg(id ORDER BY id) FROM nearby_toilets(41, 29, 1000))
         = ARRAY['00000000-0000-4000-8000-000000000001',
                 '00000000-0000-4000-8000-000000000002',
                 '00000000-0000-4000-8000-000000000003']::uuid[], 'TC-12 cleared';
    ASSERT (SELECT array_agg(id ORDER BY id) FROM nearby_toilets(41, 29, 1000, p_is_free => true))
         = ARRAY['00000000-0000-4000-8000-000000000002',
                 '00000000-0000-4000-8000-000000000003']::uuid[], 'TC-13';
END $$;

\echo '== TC-14 empty store returns no rows'
BEGIN;
DELETE FROM toilets;
DO $$
BEGIN
    ASSERT NOT EXISTS (SELECT 1 FROM nearby_toilets(41, 29, 1000)), 'TC-14';
END $$;
ROLLBACK;

\echo '== edge: open-now in Europe/Istanbul at noon and 23:00'
DO $$
BEGIN
    -- noon: 24/7 (E1), daytime (E2), inside boundary (E8). Overnight, unknown, unparsed,
    -- maintenance, closed and outside-radius rows are excluded.
    ASSERT (SELECT array_agg(source_id ORDER BY distance_m)
            FROM nearby_toilets(41.05, 29.05, 1000, p_open_now => true,
                                p_at => '2026-10-21 12:00 Europe/Istanbul') n
            JOIN toilets USING (id)) = ARRAY['E1', 'E2', 'E8'], 'open at noon';
    ASSERT (SELECT array_agg(source_id ORDER BY distance_m)
            FROM nearby_toilets(41.05, 29.05, 1000, p_open_now => true,
                                p_at => '2026-10-21 23:00 Europe/Istanbul') n
            JOIN toilets USING (id)) = ARRAY['E1', 'E5', 'E8'], 'open at 23:00';
    ASSERT opening_hours_is_open('20:00-08:00', '2026-10-21 08:00 Europe/Istanbul') IS FALSE,
        'closing minute is closed';
    ASSERT opening_hours_is_open('Mo-Fr 09:00-17:00', now()) IS NULL, 'unparsed hours are unknown';
END $$;

\echo '== edge: radius boundary'
DO $$
DECLARE inside float8; outside float8;
BEGIN
    SELECT distance_m INTO inside  FROM nearby_toilets(41.05, 29.05, 2000) n JOIN toilets USING (id) WHERE source_id = 'E8';
    SELECT distance_m INTO outside FROM nearby_toilets(41.05, 29.05, 2000) n JOIN toilets USING (id) WHERE source_id = 'E9';
    ASSERT inside < 1000 AND outside > 1000, format('E8 %s m, E9 %s m', inside, outside);
    ASSERT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, ceil(inside)) n JOIN toilets USING (id) WHERE source_id = 'E8'),
        'row at the radius is included';
    ASSERT NOT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, 1000) n JOIN toilets USING (id) WHERE source_id = 'E9'),
        'row past the radius is excluded';
END $$;

\echo '== edge: unknown (NULL) matches neither true nor false'
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, 1000) n JOIN toilets USING (id) WHERE source_id = 'E3'),
        'E3 visible without filters';
    ASSERT NOT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, 1000, p_has_disabled_access => true)  n JOIN toilets USING (id) WHERE source_id = 'E3');
    ASSERT NOT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, 1000, p_has_disabled_access => false) n JOIN toilets USING (id) WHERE source_id = 'E3');
    ASSERT NOT EXISTS (SELECT 1 FROM nearby_toilets(41.05, 29.05, 1000, p_is_free => false) n JOIN toilets USING (id) WHERE source_id = 'E3');
    ASSERT (SELECT array_agg(source_id ORDER BY source_id)
            FROM nearby_toilets(41.05, 29.05, 1000, p_is_free => false) n JOIN toilets USING (id))
         = ARRAY['E2', 'E5'], 'paid filter';
    ASSERT (SELECT has_baby_changing IS NULL AND price_try IS NULL FROM toilets WHERE source_id = 'E3'),
        'seed keeps unknown values NULL';
END $$;

\echo '== constraints reject invalid rows'
DO $$
BEGIN
    BEGIN
        INSERT INTO toilets (source, source_id, name, latitude, longitude, district) VALUES ('t', 'x1', 'Bad', 95, 29, 'Kadıköy');
        RAISE EXCEPTION 'latitude 95 accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO toilets (source, source_id, name, latitude, longitude, district) VALUES ('t', 'x2', 'Bad', 41, 200, 'Kadıköy');
        RAISE EXCEPTION 'longitude 200 accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO toilets (source, source_id, name, latitude, longitude, district, is_free, price_try)
        VALUES ('t', 'x3', 'Bad', 41, 29, 'Kadıköy', true, 5);
        RAISE EXCEPTION 'free toilet with a price accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO toilets (source, source_id, name, latitude, longitude, district) VALUES ('fixture', 'A', 'Dup', 41, 29, 'Kadıköy');
        RAISE EXCEPTION 'duplicate (source, source_id) accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
END $$;

\echo '== spatial index is usable by the nearby query'
BEGIN;
SET LOCAL enable_seqscan = off;
DO $$
DECLARE line text; found boolean := false;
BEGIN
    FOR line IN EXECUTE 'EXPLAIN SELECT * FROM nearby_toilets(41, 29, 1000)' LOOP
        found := found OR line LIKE '%toilets_location_gix%';
    END LOOP;
    ASSERT found, 'nearby query does not use toilets_location_gix';
END $$;
ROLLBACK;

\echo '== sample: nearby open toilets around the contract origin'
SELECT name, round(distance_m::numeric, 1) AS distance_m, is_open_now, has_disabled_access, is_free
FROM nearby_toilets(41, 29, 1000);

\echo 'ALL CHECKS PASSED'
