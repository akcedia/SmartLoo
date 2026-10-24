# Facility store: PostgreSQL/PostGIS (issue #24)

Owner: Fırat Karadoğan. Reproducible local database for the first nearby search (FR-01/02). Schema follows [er-data-dictionary.md §2.2](../docs/analysis/data/er-data-dictionary.md); search rules follow [REQUIREMENTS §3.1–3.2](../docs/REQUIREMENTS.MD).

**Status.** Schema, migrations, synthetic fixtures and the query recipe are implemented and checked on real PostGIS (`postgis/postgis:16-3.4`). The API still returns 501; wiring the backend to this store is not part of this change. Folder and env names are provisional until the shared skeleton in #23 is merged and may be moved there.

## Requirements

Docker Desktop (with WSL 2 on Windows). Nothing else is installed on the host; `psql` runs inside the container.

## Commands (run from the repository root)

```bash
docker compose -f db/docker-compose.yml up -d --wait
docker compose -f db/docker-compose.yml exec -T postgis sh /db/scripts/migrate.sh
docker compose -f db/docker-compose.yml exec -T postgis psql -v ON_ERROR_STOP=1 -f /db/seeds/fixtures.sql
```

Full check (migrate, seed twice, run all assertions; ends with `ALL CHECKS PASSED`):

```bash
docker compose -f db/docker-compose.yml exec -T postgis sh /db/scripts/check.sh
```

Start again from an empty database:

```bash
docker compose -f db/docker-compose.yml down -v
```

Connection for local tools: `postgresql://smartloo:smartloo-dev-only@localhost:5432/smartloo`. These are development-only values; override them with `SMARTLOO_DB_USER`, `SMARTLOO_DB_PASSWORD`, `SMARTLOO_DB_NAME`, `SMARTLOO_DB_PORT` (e.g. if port 5432 is taken). Names are a proposal to align with Yusuf's environment in #23.

## Files

| File | Purpose |
|---|---|
| `migrations/001_create_toilets.sql` | `toilets` table, `toilet_status` enum, GIST index, `updated_at` trigger, `opening_hours_is_open()` |
| `migrations/002_nearby_toilets.sql` | `nearby_toilets()` — query recipe for `GET /api/v1/toilets/nearby` |
| `scripts/migrate.sh` | Applies each migration once, in its own transaction, recorded in `schema_migrations` |
| `seeds/fixtures.sql` | Synthetic test data; idempotent upsert by `(source, source_id)` |
| `tests/verify.sql` | Assertions on real PostGIS (below) |

## Schema decisions

- `id` UUID (`gen_random_uuid()`); import identity `(source, source_id)` unique; `ibb_source_id` unique when present.
- `latitude`/`longitude` `numeric(9,6)` with range checks; `location geography(Point, 4326)` is a generated column, so it can never disagree with the coordinates. GIST index `toilets_location_gix`.
- `has_disabled_access`, `has_baby_changing`, `is_free`, `price_try`, `opening_hours`, `address` are nullable. NULL means **unknown**: it is shown as unknown and matches neither a `true` nor a `false` filter. Seed data never fills unknown values.
- `status` enum `ACTIVE | CLOSED | MAINTENANCE`, default `ACTIVE`. A free toilet cannot carry a positive price.
- `average_cleanliness` (1–5, NULL with no reviews) and `review_count` (≥ 0) are stored for filtering/sorting; recalculation belongs to the review flow.
- User and Suggestion tables are out of scope for #24.

## Query recipe (to agree with Özgür)

```sql
SELECT * FROM nearby_toilets(
    p_lat => :lat, p_lon => :lon, p_radius_m => :radius,          -- validated by the API first (422)
    p_open_now => :open_now,                                       -- default false
    p_has_disabled_access => :access, p_has_baby_changing => :baby, p_is_free => :free  -- NULL = no filter
);
```

Inside: `ST_DWithin(location, origin, radius)` selects rows (uses the GIST index), `ST_Distance` gives `distance_m` (geodesic metres, not walking distance), ordered by distance then `id`. With `open_now = true` only `ACTIVE` rows with known, currently open hours are returned. The backend can call the function or inline the same SQL; the response mapping to `{count, results}` stays in the API.

**Opening hours — open decision.** `opening_hours_is_open()` evaluates in `Europe/Istanbul` and understands only `24/7` and one daily `HH:MM-HH:MM` range (overnight allowed). Any other text returns unknown and is excluded from open-only results. The real format depends on the İBB source mapping (#14/#22).

## Test data (synthetic, not real facilities)

**Contract set** — same UUIDs and positions as `tests/test_requirements.py`, origin `41.000, 29.000`:

| Alias | UUID suffix | Lat | Distance | Access | Baby | Free | Status |
|---|---|---|---|---|---|---|---|
| A | `…0001` | 41.001 | 111 m | yes | yes | no | ACTIVE |
| B | `…0002` | 41.004 | 444 m | no | yes | yes | ACTIVE |
| C | `…0003` | 41.002 | 222 m | yes | no | yes | CLOSED |
| D | `…0004` | 41.020 | 2,221 m | yes | yes | no | ACTIVE |

**Edge set** — origin `41.050, 29.050`, district Üsküdar, names start with `[TEST]`:

| Alias | Case |
|---|---|
| E1 | Open 24/7, free, baby-changing unknown |
| E2 | Daytime `08:00-20:00`, paid 5 TRY |
| E3 | Hours and every amenity unknown |
| E4 | `MAINTENANCE` |
| E5 | Overnight `22:00-06:00`, paid with unknown price |
| E6 | Unparsed hours text (`Mo-Fr 09:00-17:00`) → unknown |
| E7 | `CLOSED` |
| E8 | ~988 m — just inside a 1000 m radius |
| E9 | ~1,111 m — just outside |

## What `verify.sql` checks

- Seed size, and no duplicates after seeding twice.
- TC-01 order and distances (111 ± 3 m, 444 ± 5 m); TC-02, TC-03, TC-12, TC-13 filter sets; TC-14 empty store.
- Open-now at a fixed Istanbul time (noon and 23:00), closing minute, unknown/unparsed hours.
- Radius boundary (row exactly at the radius included, row past it excluded).
- NULL amenities match neither `true` nor `false`; seed keeps unknown values NULL.
- Constraints reject latitude 95, longitude 200, free-with-price and duplicate `(source, source_id)`.
- The nearby query can use `toilets_location_gix`.

Not covered yet: NFR-01 performance with 10,000 rows, and the API layer itself.
