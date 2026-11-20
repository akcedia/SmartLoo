# #59 GeoJSON normalization — independent first slice

17 November 2026. This brings forward the independently testable part of
Thursday's adapter work while review/Redis interfaces are being coordinated.
Base: main `24611dde`. Separate branch: `feature/59-geojson-normalization`.
The AI implementation remains separately tracked in draft PR #68.

## Behavior and boundaries

`src/ibb_geojson.py` exposes `normalize_geojson(document)` for a JSON string or
parsed FeatureCollection. It is a read-only transformation, with no network,
database, environment variables, dependencies or permission to import records.
It follows `docs/design/adapter-ai-contract.md` sections 3–5 and the SQL name
limit in `db/migrations/001_create_toilets.sql`.

- Geometry must be Point with exactly two finite numeric coordinates in
  longitude/latitude order. Booleans, numeric strings, 3D points, out-of-range
  coordinates, NaN and infinity are rejected. Geometry is never reconstructed
  from X/Y, nor are coordinate axes silently swapped.
- Name and district are required. Display normalization uses Unicode NFC and
  whitespace collapse, preserving Turkish letters and case. Name is capped at
  150 Unicode code points; long names are rejected, not truncated.
- Supplied X/Y must be numeric and within the proposed 1e-8-degree consistency
  tolerance of geometry. This is not evidence of physical location accuracy.
- Whitelisted raw metadata is preserved. Explicit null text metadata stays null;
  absent metadata stays absent. An explicit null X/Y is invalid, not missing.
- Missing accessibility, baby-changing, price, fee and hours information stays
  null. `BAKIM_ODASI=Var` does not establish baby-changing availability. Source
  `Aktif/Pasif` labels are retained without asserting SQL status or open-now.
- `Dönemlik`, blank and unknown supplied status strings reject the batch as
  unresolved. Missing/null status remains unknown. Every result still needs an
  approved SQL/status/calendar mapping before import.
- Same normalized name/district and exact numeric coordinates cause an identity
  conflict for review. Same coordinates with different names remain separate
  candidates and produce a warning. Neither case is automatically merged.
- One invalid record suppresses the entire candidate list, with zero-based
  record/field errors. Duplicate JSON keys and nonfinite JSON constants are
  rejected for string input. No exception message echoes raw records.

`valid=true` refers only to normalization. `import_ready` is **always false**.
Source identity, status mapping and persistence integration stay in
`pending_decisions`. Candidates deliberately have no UUID, source_id, guessed
SQL status, hygiene score or live occupancy. They are not insertable SQL rows.
Downstream code must explicitly map approved identities/statuses and may never
let SQL's ACTIVE default resolve missing source status implicitly.

The internal result's `warnings`, `import_ready`, `pending_decisions` and
`FIELD_TOO_LONG` code are integration proposals, not public API changes. Source
identity candidate keys are only for duplicate review; no final fingerprint,
alias registry, upsert policy or repeat-import correctness is implemented.
JSON parsing uses standard Python numbers, so do not derive a final precise
source fingerprint from these candidates without the approved precision policy.

## Usage and verification

```sh
python3 -m unittest discover -s tests -p test_ibb_geojson.py -v
python3 -m examples.ibb_geojson_demo
```

20 tests passed, 0 failed, 0 skipped on macOS / Python 3.14.3 (0.004 seconds).
Only synthetic records are used. Tests map to normalization portions of
A01–A06, A08, A09 and A11. They do not establish all of TC-19/20/36, transactional
DB atomicity, live source access or accepted real-source identity.

The demo compares a valid synthetic candidate against a batch containing
`Dönemlik`. The first remains non-importable; the second returns errors and no
candidates. No actual İBB records were downloaded or published.

Still pending with Fırat/Özgür: source fingerprint serialization and precision,
approved fingerprint/UUID aliases, physical duplicate resolution, idempotent
DB writes and failure recovery, status/calendar decisions. A07 repeat import,
A10 rename/relocation and A12 source outage need later components. No data
disappearing from a source file is deleted or closed by this module.

## 21 November integration decision and delivery

The preceding section records Emir's original independent slice, retained with
his author commit. `feature/61-ibb-live-data` starts from main `2ac2a60`, reuses
that slice, and supplies the separately reviewable persistence/map integration.
The default normalizer remains strict; integration explicitly permits Dönemlik.

Özgür explicitly selected displaying all seasonal records as **unknown** rather
than excluding them. Migration 006 makes administrative status nullable, keeping
the existing enum/default for normal records. Aktif maps to ACTIVE, Pasif to
CLOSED, Dönemlik/missing to NULL. Unknown status/hours never imply open-now.
No new enum value, occupancy, hours, price or amenity information is invented.

### Verified official snapshot

- Source: [İBB Şehir Tuvaletleri](https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti).
- Resource UUID: `9585ab4a-d160-4541-8a41-b86eeec4c1cc`.
- Downloaded 21 November 2026, SHA-256
  `ef2fe26868a94d0bd23d8c4da1d5a53b1792682bc5c722b218ea5dd2a5e1d704`.
- 436 source rows: 407 Aktif, 22 Pasif, 7 Dönemlik. Four excess exact full-feature
  duplicates produce 432 display/source identities in 37 districts: 403 ACTIVE,
  22 CLOSED, 7 unknown. These are source identities, not independently surveyed
  counts of physical toilets. Original duplicate indexes remain in the plan.
- Attribution and license links are visible on the map. Reuse terms were read
  at [İBB Açık Veri Lisansı](https://data.ibb.gov.tr/license); attribution does not
  imply municipal endorsement. No usage-statistics data is joined to hygiene.

### Identity and transaction policy

`ibb-v1` uses NFC/whitespace-normalized, case-preserved name, canonical Turkish
Istanbul district, and the original geometry's exact decimal longitude/latitude
in `["ibb","v1",district,name,longitude,latitude]`. Canonical UTF-8 JSON is SHA-256
hashed; `source_id` is `v1:<hash>`. Coordinates are never read back from rounded
SQL numeric(9,6) values to derive identity. The provider supplies no stable ID;
`ibb_source_id` remains null. `external_source_identities` binds fingerprints,
original identity components and persistent SmartLoo UUIDs, allowing reviewed
aliases for renamed/moved facilities.

Only byte-equivalent normalized full-feature repetitions are grouped in a plan;
same identity with different metadata is rejected. Same coordinates alone do not
merge different names. A plan contains every source row group, target UUID,
new identity, possible existing match and source identities absent from the file.
Every application requires the exact plan SHA-256. This explicitly approves the
complete initial candidate set and duplicate grouping; it is not an automatic
physical-duplicate resolution policy. Keep the raw snapshot and reviewed plan
as local evidence; bulk raw files are not committed.

Possible name/position matches are checked again against the live database,
not trusted from editable plan hints. A matching existing UUID must be explicitly
selected as an alias. Existing mappings cannot be reassigned, batch targets
cannot collide, and another source's facility cannot be overwritten. A completely
changed name AND position cannot be reliably matched automatically: inspect new
and absent identities in every subsequent plan. Absent records are never deleted
or automatically closed.

Source edits update only provided identity/administrative metadata. Curated
amenities, hours, price, review aggregates, count and revision are preserved.
New records leave missing optional fields null. Whitelisted source metadata is
retained separately. All facility writes, identity mappings and import provenance
commit in one SQL transaction. Any validation, SQL or matching failure rolls the
batch back. Source-wide and shared review advisory locks serialize imports and
reject busy/durable pending review operations. No Mongo mutation is performed.

Download uses one fixed HTTPS official resource, bounded size/time, rejects
redirects and validates the complete nonempty batch before replacing a local
snapshot. Failure does not call the writer or alter existing facilities. The
application reads persisted last-imported data; it does not download on startup.

### Commands and runtime

Use a dedicated local environment. The verified real-data instance is Compose
project `smartloo-ibb`, PostGIS host port **5437**, DB/user/password as documented
in the shared development defaults. Existing test projects are preserved.

```powershell
$env:SMARTLOO_DB_HOST = '127.0.0.1'
$env:SMARTLOO_DB_PORT = '5437'
docker compose -p smartloo-ibb up -d --wait postgis
docker compose -p smartloo-ibb exec -T postgis sh /db/scripts/migrate.sh
python scripts/import_ibb.py download --source .venv/ibb-source.geojson
python scripts/import_ibb.py plan --source .venv/ibb-source.geojson --plan .venv/ibb-plan.json
# Review every mapping, exact-duplicate group, new/absent identity and hint.
python scripts/import_ibb.py apply --source .venv/ibb-source.geojson --plan .venv/ibb-plan.json --approve-plan <printed-plan-sha256>
```

The actual initial plan applied locally had digest
`6d512770e62204494fb063ffa5de79c3c3060df65c034e42a0c93db9e1986ec2`:
first application inserted 432; repeat inserted/updated 0 and retained 432.
Future generated plans also include absent-identity reporting; do not reuse a
plan digest after editing/regenerating it.

Additive public `GET /api/v1/toilets` returns only persisted `source=ibb` rows,
with the existing boolean/price filter semantics and source/license metadata.
It returns 503 before the first import or above the 2000-row directory capacity,
rather than presenting unloaded/truncated data as a complete city. Existing
`/toilets/nearby` validation, 50 km limit, detail and review routes remain.

The map starts in **İstanbul’daki İBB tesisleri** mode with open-only off. It fits
all current filtered source coordinates, shows the source-record count and
attribution, and provides **Yakınımda ara** plus the existing radius/center search.
No citywide distance is invented. Unknown amenities and prices do not pass known
true/false filters. With this snapshot, open-only returns zero because hours are
unknown; this is expected, not a reason to assume 24/7.

### Validation and remaining scope

- 37 import/normalizer checks pass, including real temporary SQL databases,
  repeat import, reviewed rename alias, precision, full transaction rollback,
  pending/live review locks and public directory/detail/nearby semantics.
- 97 frontend tests and production build pass. City-mode contract, error vs empty
  and return to nearby mode are covered; map rendering is verified separately.
- Actual browser: 432 Leaflet marker elements, city bounds, real facility detail,
  unknown fields, open-only zero, restore all, and nearby mode. At 360x800 the
  document width is 360; detail panel stays within x=16..344 and y=310..784.
- Existing regression run: 132 passed, one eight-writer review test encountered
  the pre-existing two-second lock wait under concurrent local load. Its isolated
  re-run passed (1 test, 14.63 seconds). The initial run is not represented as clean.
- New CI workflow runs the 37 required cases on real PostGIS and rejects skips.
  Official network download is not required for deterministic CI.

This is external-source ingestion plus a public map view, not the separate
ADMIN CSV/JSON upload endpoint (still pending), AI acceptance, all of #59, or
full keyboard/performance/NVDA acceptance. PR #69 remains open until this reused
contribution is reviewed/merged and closure is separately authorized.
