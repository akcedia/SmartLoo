-- SYNTHETIC TEST DATA ONLY. Not real İBB facilities; every name starts with "Fixture" or "[TEST]".
-- Idempotent: re-running upserts by (source, source_id), so rows never multiply (REQ-DB-06).
--
-- Set "contract" mirrors tests/test_requirements.py (same UUIDs A-D, origin 41.000, 29.000),
-- so TC-01/02/03/12/13/14 expectations can be checked against real PostGIS.
-- Set "edge" sits around a separate origin (41.050, 29.050) so it never changes contract results.

INSERT INTO toilets (id, source, source_id, name, latitude, longitude, district,
                     has_disabled_access, has_baby_changing, is_free, price_try,
                     opening_hours, status)
VALUES
    -- contract: id                                  source_id  name         lat     lon     district   access baby  free  price  hours   status
    ('00000000-0000-4000-8000-000000000001', 'fixture', 'A', 'Fixture 1', 41.001, 29.000, 'Kadıköy', true,  true,  false, NULL, '24/7', 'ACTIVE'),
    ('00000000-0000-4000-8000-000000000002', 'fixture', 'B', 'Fixture 2', 41.004, 29.000, 'Kadıköy', false, true,  true,  NULL, '24/7', 'ACTIVE'),
    ('00000000-0000-4000-8000-000000000003', 'fixture', 'C', 'Fixture 3', 41.002, 29.000, 'Kadıköy', true,  false, true,  NULL, '24/7', 'CLOSED'),
    ('00000000-0000-4000-8000-000000000004', 'fixture', 'D', 'Fixture 4', 41.020, 29.000, 'Kadıköy', true,  true,  false, NULL, '24/7', 'ACTIVE'),

    -- edge: open/closed/unknown hours, NULL amenities, radius boundary
    ('00000000-0000-4000-8000-000000000101', 'synthetic', 'E1', '[TEST] E1 open 24/7, free',              41.0505, 29.050, 'Üsküdar', true,  NULL,  true,  NULL, '24/7',              'ACTIVE'),
    ('00000000-0000-4000-8000-000000000102', 'synthetic', 'E2', '[TEST] E2 daytime 08-20, paid 5 TRY',    41.0510, 29.050, 'Üsküdar', false, true,  false, 5.00, '08:00-20:00',       'ACTIVE'),
    ('00000000-0000-4000-8000-000000000103', 'synthetic', 'E3', '[TEST] E3 everything unknown',           41.0515, 29.050, 'Üsküdar', NULL,  NULL,  NULL,  NULL, NULL,                'ACTIVE'),
    ('00000000-0000-4000-8000-000000000104', 'synthetic', 'E4', '[TEST] E4 under maintenance',            41.0520, 29.050, 'Üsküdar', true,  true,  true,  NULL, '24/7',              'MAINTENANCE'),
    ('00000000-0000-4000-8000-000000000105', 'synthetic', 'E5', '[TEST] E5 overnight 22-06, price unknown', 41.0525, 29.050, 'Üsküdar', true,  false, false, NULL, '22:00-06:00',     'ACTIVE'),
    ('00000000-0000-4000-8000-000000000106', 'synthetic', 'E6', '[TEST] E6 unparsed hours text',          41.0530, 29.050, 'Üsküdar', true,  true,  true,  NULL, 'Mo-Fr 09:00-17:00', 'ACTIVE'),
    ('00000000-0000-4000-8000-000000000107', 'synthetic', 'E7', '[TEST] E7 administratively closed',      41.0535, 29.050, 'Üsküdar', true,  true,  true,  NULL, '24/7',              'CLOSED'),
    ('00000000-0000-4000-8000-000000000108', 'synthetic', 'E8', '[TEST] E8 just inside 1000 m',           41.0589, 29.050, 'Üsküdar', true,  true,  true,  NULL, '24/7',              'ACTIVE'),
    ('00000000-0000-4000-8000-000000000109', 'synthetic', 'E9', '[TEST] E9 just outside 1000 m',          41.0600, 29.050, 'Üsküdar', true,  true,  true,  NULL, '24/7',              'ACTIVE')
ON CONFLICT (source, source_id) DO UPDATE SET
    name                = EXCLUDED.name,
    latitude            = EXCLUDED.latitude,
    longitude           = EXCLUDED.longitude,
    district            = EXCLUDED.district,
    has_disabled_access = EXCLUDED.has_disabled_access,
    has_baby_changing   = EXCLUDED.has_baby_changing,
    is_free             = EXCLUDED.is_free,
    price_try           = EXCLUDED.price_try,
    opening_hours       = EXCLUDED.opening_hours,
    status              = EXCLUDED.status;
