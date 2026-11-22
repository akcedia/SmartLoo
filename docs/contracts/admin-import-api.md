# ADMIN facility import (FR-07 / REQ-DB-06)

21 November 2026. Backend integration proposal for #61, paired with TC-19/20/36.
This is the normalized CSV/JSON upload API; the reviewed raw GeoJSON importer
remains a separate path. No real source data is uploaded during these tests.

## Request and response

`POST /api/v1/admin/import`, `Authorization: Bearer <ADMIN token>`.
The current stored role is checked, not trusted from the token's role claim.
Authentication precedes body parsing. Send a JSON array with
`Content-Type: application/json`, or a raw comma-delimited UTF-8 CSV file with
`Content-Type: text/csv`. UTF-8 BOM is accepted. This endpoint does not accept
multipart forms. Maximum body: 1,000,000 bytes; maximum records: 1000.

Required columns: `source`, `source_id`, `name`, `district`, `latitude`,
`longitude`. Source namespace uses lowercase ASCII letters/digits/hyphens or
underscores, starting with a letter (max 50). Source ID max 200, name max 150,
district max 100. Text is NFC-normalized and trimmed; controls are rejected.
Coordinates must be finite and within latitude ±90/longitude ±180; SQL stores
six decimal places. Duplicate source identities within a file reject the batch.

Optional columns: `address` (1000), `opening_hours` (100),
`has_disabled_access`, `has_baby_changing`, `is_free`, `price_try`, `status`,
`ibb_source_id` (200). Extra fields such as user roles, UUIDs, review scores,
counts, revisions and raw source_properties are rejected.

- JSON booleans must be actual true/false/null, not strings or 0/1. CSV uses
  true/false (case-insensitive) or an empty cell for unknown.
- Omitted optional metadata preserves an existing value. Explicit null/empty
  CSV cells set unknown values. New records default to unknown, including status;
  nothing silently assumes ACTIVE, free or accessible.
- Status is ACTIVE/CLOSED/MAINTENANCE/null. Fees are 0..999999.99 with two
  decimal places. A free facility cannot have a positive fee, including a fee
  preserved from an earlier record.
- A known ibb_source_id cannot be cleared or reassigned. Provider IDs must be
  real supplied identifiers; the API does not infer them from names/coordinates.

Synthetic JSON example (not a statement about an actual facility):

```json
[{"source":"example","source_id":"provider-42","name":"Örnek Tesis",
  "district":"Kadıköy","latitude":41.001,"longitude":29.0,
  "is_free":false,"status":"ACTIVE"}]
```

Success 200: `{"inserted":1,"updated":0,"unchanged":0,"rejected":0}`.
`updated` counts matched existing identities, per TC-19; `unchanged` is the subset
with identical metadata. Therefore repeating an identical row gives updated=1,
unchanged=1, inserted=0, retaining its UUID and revision. Actual metadata changes
increment review_version once; aggregates and reviews are preserved.

| Status | Meaning |
| --- | --- |
| 401 / 403 | Missing/invalid/expired session or non-ADMIN role; no import |
| 413 / 415 | Body too large or unsupported content type |
| 422 | Malformed/invalid rows, duplicate batch identities or forbidden raw-source changes; zero writes |
| 409 | Existing provider/registered identity conflict; whole transaction rolled back |
| 503 | Store failure, another import/writer busy, or durable review repair pending; zero committed writes |

422 returns a **top-level** `errors` array and `atomic: true`, with logical record
numbers starting at 1 (0 means file/header). At most 50 safe errors are returned;
the whole batch is rejected even if not every error is listed. Errors omit raw
input values, SQL details, tokens and file contents.

## Identity, transaction and revision rules

Upsert by `(source, source_id)`; retain existing UUID and provider identity. No
fuzzy/name/coordinate-only merge or deletion occurs. Known external registry
aliases resolve to their existing facility; conflicting alias/primary bindings
or multiple file identities targeting one facility reject the batch.

Unregistered raw İBB v1 fingerprints cannot be introduced here. A registered raw
identity's name/district/coordinates/state cannot be changed through CSV/JSON;
use its reviewed GeoJSON plan or the dedicated closure service for state changes.
Curated amenity, price, address and schedule fields may be updated explicitly.
The existing registry, raw metadata and source import provenance are preserved.
Normalized ADMIN uploads do not count as a complete official portal snapshot.

PostgreSQL performs all writes in one transaction. It shares the raw importer
mutex (-610061) and existing facility advisory-lock keys, acquiring all facility
locks before updates. Durable pending review operations block the entire batch.
Rows are reread under those guards before merging omitted metadata, avoiding
lost updates. Each statement has a five-second timeout and row-lock waits a
two-second timeout. SQL failure after an earlier write still rolls everything
back. No Mongo write or cross-store compensation is needed for this route.

The isolated test repository uses staged state plus the same review guards; real
registry aliases and SQL transaction behavior are verified in private databases.

## Verification and frontend handoff

The required `admin-import-integration` CI suite starts PostGIS, migrates private
test databases and requires 39 passing cases without failures/errors/skips:

```sh
python -m pytest tests/test_admin_import.py tests/test_admin_import_postgres.py tests/test_requirements.py -q -k 'admin_import or tc_19 or tc_20 or tc_36' --junitxml=required-results.xml
python scripts/check_required_junit.py required-results.xml --minimum 39
```

Use SMARTLOO_TEST_POSTGIS=1 and test SQL connection settings. Nine real-database
cases cover repeat CSV/JSON, preserved UUID/provider ID/aggregates/metadata,
validation rollback, server-side SQL failure after a write, writer/repair and raw
import mutexes, registry aliases, provider collisions, concurrent retry and role
downgrade. Twenty-six isolated cases plus four existing acceptance instances
cover parsing/bounds/role/input behavior. Private databases are dropped afterward;
the live 432-record directory is never reset.

Onur's ADMIN upload UI should reuse the shared session client, show row errors
and import counts, and send CSV bytes without JSON-stringifying them. The common
client currently needs explicit raw-body/error-array support for that screen.
Frontend upload/browser acceptance is **not** completed by this backend PR.

## Local verification snapshot

21 November 2026, based on main 85031d2. Required import suite: 39 passed,
0 failed/errors/skipped. Shared auth/reviews/detail/search/analytics/deletion and
launcher regression suites: 151 passed, 0 failed/errors/skipped. The existing
auth guard test now expects 415 after successful ADMIN authorization instead
of the removed 501 placeholder; its 401/403 checks remain unchanged.

The complete isolated requirements catalog reports 42 passed and 10 failed
out of 52 instances. Remaining failures: TC-07/18 suggestion and moderation,
TC-27 closure, TC-08/15/16/17/28 AI, and TC-21 HTML frontend serving. These
results do not establish browser upload acceptance or complete product readiness.
The catalog is a backend fixture harness; frontend evidence remains separate.
