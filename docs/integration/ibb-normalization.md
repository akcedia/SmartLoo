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
