# Admin analytics API contract (integration candidate)

Owner: Onur Arda Buldağ (issue [#29](https://github.com/akcedia/SmartLoo/issues/29)). Backend reviewer: Özgür Kılıç. Version 0.3, 20 November 2026.
Covers FR-06 and FR-07 export. Baseline: [REQUIREMENTS.MD §3.6, §3.7, §8](../REQUIREMENTS.MD), [dashboard-import-export.md](../analysis/behavior/dashboard-import-export.md), [UI Spec Lite — Administration](../analysis/ui-spec-lite.md).

**Status: Implemented and locally verified in PR #71; review and main merge pending.** Fields marked *required* are fixed by the requirements and the HTTP contract tests (TC-09, TC-10, TC-24, TC-25). Fields marked *proposed* describe the panel contract for joint review. Both endpoints are wired to real auth and stores in [src/app.py](../../src/app.py) on this branch.

## 1. Shared rules

| Topic | Rule | Source |
|---|---|---|
| Authorization | `Authorization: Bearer <JWT>`. Missing/invalid/expired token → 401; valid USER → 403; only ADMIN reads metrics or exports. | §3.8, auth-account.md |
| Hiding the route is not security | The frontend hides the dashboard for non-ADMIN users only for convenience. The backend RBAC check above is the only protection. | #29 |
| Query parameters | `district`, `from`, `to` (and `format` for export). Same names, same meaning on both endpoints. | §8 API table |
| `district` | Optional. Omitted means all districts. Exact Turkish name as stored in `Toilet.district` (e.g. `Kadıköy`). | dashboard-import-export.md §1 |
| `from`, `to` | `YYYY-MM-DD` calendar dates, both **inclusive**, interpreted in **Europe/Istanbul**. Implemented as the half-open interval `[from 00:00, (to + 1 day) 00:00)` Istanbul time. | §3.6 |
| Date field | Filter applies to `Review.created_at`. | D-5 resolved |
| Defaults | If both dates are omitted, use today and the previous 29 Istanbul calendar days. For the last-seven-days preset, send today and the previous six days. If only one boundary is supplied, return 422 and identify the missing boundary. | §3.6, §5 |
| Invalid input | Non-date strings, `from > to`, or more than **366 inclusive calendar days** → 422 with the canonical FastAPI validation body naming the field (`to` for an oversized range). | §1 decision table |
| Unknown district | 200 with zero matching facilities and the no-data review metrics. Echo the selected dates and district. | §5 |

### Boundary example

`from=2026-10-01&to=2026-10-07` selects reviews with `2026-10-01T00:00:00+03:00 ≤ created_at < 2026-10-08T00:00:00+03:00`. A review at `2026-10-07T23:59:59+03:00` is included; one at `2026-10-08T00:00:00+03:00` is not.

## 2. `GET /api/v1/admin/metrics/summary`

### 2.1 Fields

| Field | Type | Status | Meaning |
|---|---|---|---|
| `average_cleanliness` | number \| null | required | Arithmetic mean of **individual eligible review scores** in the selection. Not a mean of facility means. `null` when there are no reviews — never `0`. |
| `review_count` | integer | required | Number of eligible reviews. `0` when there is no data. |
| `critical_alert` | boolean | required | `true` iff `average_cleanliness` is not null and **strictly** `< 3.5`. `false` for no data. UI text: “Acil Müdahale Gerekli”. |
| `filters` | object | proposed | Echo of the resolved selection: `district` (string \| null), `from`, `to`, `timezone: "Europe/Istanbul"`. Lets the UI show exactly what the server applied (incl. defaults). |
| `critical_threshold` | number | proposed | `3.5`, so the UI does not hard-code the business rule. |
| `active_facility_ratio` | object \| null | proposed | `{ "active": int, "total": int }` from administrative `status` of facilities in the district (not occupancy, not date-filtered). `null` when status data is unavailable → UI shows “Unknown”. |
| `trend` | array | proposed | One row per Istanbul calendar day in the selection: `{ "date", "average_cleanliness" (number \| null), "review_count" }`. Days without reviews have `null`, not `0`. |
| `facilities` | array | proposed | Table rows: `{ "facility_id", "name", "district", "status", "hygiene_score" (number \| null), "review_count" }`. `hygiene_score` is the facility's mean over the same eligible reviews. Includes facilities in the district with zero reviews in the period (`hygiene_score: null`). |

All three views (KPI, trend, table) are computed from the **same** selection (TC-09).

### 2.2 Example — TC-09 selection

`GET /api/v1/admin/metrics/summary?district=Kadıköy&from=2026-10-01&to=2026-10-07`

```json
{
  "filters": { "district": "Kadıköy", "from": "2026-10-01", "to": "2026-10-07", "timezone": "Europe/Istanbul" },
  "average_cleanliness": 3.0,
  "review_count": 2,
  "critical_alert": true,
  "critical_threshold": 3.5,
  "active_facility_ratio": { "active": 1, "total": 1 },
  "trend": [
    { "date": "2026-10-01", "average_cleanliness": null, "review_count": 0 },
    { "date": "2026-10-02", "average_cleanliness": 4.0, "review_count": 1 },
    { "date": "2026-10-03", "average_cleanliness": 2.0, "review_count": 1 },
    { "date": "2026-10-04", "average_cleanliness": null, "review_count": 0 }
  ],
  "facilities": [
    { "facility_id": "00000000-0000-4000-8000-000000000001", "name": "Example facility", "district": "Kadıköy", "status": "ACTIVE", "hygiene_score": 3.0, "review_count": 2 }
  ]
}
```

(`trend` shortened; it continues to `2026-10-07`. The September review and the Beşiktaş review are excluded.)

### 2.3 Example — existing facility, zero eligible reviews (TC-25)

Return `average_cleanliness: null`, `review_count: 0` and `critical_alert: false` when no reviews match. The trend still contains one row per selected day with a null average and a zero count. The facility list still contains every matched facility with a null hygiene score and a zero review count. The administrative status ratio remains available when statuses are known. The panel can show a no-data message for review metrics while retaining the facility rows.

`GET /api/v1/admin/metrics/summary?district=Kadıköy&from=2026-10-01&to=2026-10-02`

```json
{
  "filters": { "district": "Kadıköy", "from": "2026-10-01", "to": "2026-10-02", "timezone": "Europe/Istanbul" },
  "average_cleanliness": null,
  "review_count": 0,
  "critical_alert": false,
  "critical_threshold": 3.5,
  "active_facility_ratio": { "active": 1, "total": 1 },
  "trend": [
    { "date": "2026-10-01", "average_cleanliness": null, "review_count": 0 },
    { "date": "2026-10-02", "average_cleanliness": null, "review_count": 0 }
  ],
  "facilities": [
    { "facility_id": "00000000-0000-4000-8000-000000000001", "name": "Example facility", "district": "Kadıköy", "status": "ACTIVE", "hygiene_score": null, "review_count": 0 }
  ]
}
```

If there are no matching facilities, return the same null KPI and daily trend values, `facilities: []` and `active_facility_ratio: null`.

### 2.4 Why the overall mean is review-weighted

Facility A has reviews 5, 5, 5, 5 and facility B has one review of 1. Review-weighted mean = 21 / 5 = **4.2** (correct). Mean of facility means = (5 + 1) / 2 = **3.0** (wrong — it would raise a false critical alert). The panel never recomputes the KPI from table rows.

## 3. `GET /api/v1/admin/analytics/export`

Parameters: `format` (`csv` | `json`, required), plus the same `district`, `from`, `to` as the summary. The panel always sends the filters currently shown on screen, so the export describes the same selection as the dashboard.

Export one row per matched facility, including facilities with zero eligible reviews. An empty facility selection yields a header-only CSV or JSON with `count: 0` and `results: []`.

### 3.1 Columns (fixed, both formats)

`facility_id, district, hygiene_score, open_issues_count, last_cleaned_at`

| Column | Meaning |
|---|---|
| `facility_id` | Facility UUID. |
| `district` | Facility district. |
| `hygiene_score` | Selected-period facility review average (same eligible reviews as the KPI). No reviews in period → blank / null. |
| `open_issues_count` | Imported/administrative value only. Absent → blank (CSV) / null (JSON). Never inferred from review text or AI. |
| `last_cleaned_at` | Imported/administrative value only. Absent → blank / null. |

No further operational columns are added; values the system does not have are not invented.

### 3.2 CSV

- `Content-Type: text/csv; charset=utf-8`, body starts with UTF-8 BOM (`EF BB BF`), RFC 4180 quoting, CRLF line endings.
- `Content-Disposition: attachment; filename="smartloo-hygiene-<district|all>-<from>_<to>.csv"` plus RFC 5987 `filename*=UTF-8''…` for Turkish characters; the plain filename is ASCII.

```csv
facility_id,district,hygiene_score,open_issues_count,last_cleaned_at
00000000-0000-4000-8000-000000000001,Kadıköy,3.0,,
```

### 3.3 JSON

`Content-Type: application/json`. The same attachment filename and RFC 5987 rules as CSV apply, with `.json`. `results` is required (TC-24); `filters` and `count` are proposed.

```json
{
  "filters": { "district": "Kadıköy", "from": "2026-10-01", "to": "2026-10-07", "timezone": "Europe/Istanbul" },
  "count": 1,
  "results": [
    { "facility_id": "00000000-0000-4000-8000-000000000001", "district": "Kadıköy", "hygiene_score": 3.0, "open_issues_count": null, "last_cleaned_at": null }
  ]
}
```

## 4. Errors the panel handles

| Status | Panel state |
|---|---|
| 200 with `review_count = 0` | “No data” — KPI shows “No data”, no 0 score, no alert. |
| 401 | “Session expired / not signed in” with a Sign in action. |
| 403 | “This page is for administrators” — no data is rendered. |
| 422 | Filter validation message next to the date controls. |
| 5xx / network | Generic error with Retry; filters are kept. |

## 5. Integration decisions for review

| ID | Topic | Decision for the initial integration |
|---|---|---|
| Q1 | Default dates | Today and the previous 29 calendar days in Istanbul. |
| Q2 | Interval validation | Maximum **366 inclusive calendar days**; 367 or more → 422 on `to`, before store access. Agreed by Onur on 18 November in #58 and enforced by PR #71. |
| Q3 | Unknown district | 200 with zero matching facilities. |
| Q4 | District list | Keep the static Istanbul list for the demo. A source-backed list remains open. |
| Q5 | Summary shape | One response contains `trend` and `facilities`. |
| Q6 | Administrative ratio | `total` includes all matched facilities. `active` counts `ACTIVE` only. The date filter applies to reviews. |
| Q7 | Score precision | Preserve API precision and display two decimal places in the UI. |

The sample adapter covers both cases in §2.3: an existing facility without reviews and a district with no matched facilities.

### Backend data sources

Select facility metadata and administrative status in PostgreSQL. Select individual reviews from MongoDB using the selected facility UUIDs and the Istanbul timestamp interval. The review field `toilet_id` maps to `facility_id` in the response. Use these same reviews for the overall score, daily trend, facility score and export. The current facility-level aggregate in PostgreSQL describes all reviews and cannot supply date-filtered results. If the review store is unavailable, return a server error so the panel displays a retry state. Reserve an empty result for a successful query.

## 6. Not covered / not claimed

- Both routes are integrated on this branch with PostgreSQL, the #50 MongoDB score projection, and the shared ADMIN guard. Local integration evidence does not claim main merge or final project acceptance.
- The live `/admin` route uses the shared real session; the sample adapter remains an explicitly labelled opt-in mode. Account deletion, AI and external data import are separate deliveries.
- Import (`POST /api/v1/admin/import`), moderation and facility status tabs are out of scope for #29.
## 7. Stable reads and verification (20 November)

The application holds the review writer's advisory locks for every selected
facility while reading and calculating scores. A busy writer or durable
`writing` / `repair_required` marker returns **503**, without a report download.
This prevents transient Mongo changes from being presented as completed reviews.
All selection locks use one SQL connection, including 500-facility selections;
no connection is opened per facility. Each response is a coherent read. Separate
summary/export requests reuse the same filters; a completed intervening review
change may naturally change the next response.

Production readers use SQL metadata and `read_review_scores` from #50. Only the
score projection is read; no comment text or author identity enters analytics.
Tests with injected state use isolated repository readers and the same guard.
New import/status writers must coordinate with this guard when integrated.

Validation on Windows / Python 3.13 / Node 26.13.0, main `453f3e2` plus this branch:

- 39 required analytics tests: 22 unit/guard cases, 12 real PostgreSQL/Mongo
  integration cases and TC-09/10/24/25/45; zero failures/errors/skips.
- Existing auth/review/detail/search/Mongo regression suite: 99 passed.
- Frontend: 94 tests and production build passed.
- Mounted live ADMIN screen: real JWT/HTTP/PostGIS/Mongo review create/edit/delete
  changes KPI/alert and CSV/JSON; download anchor names checked in jsdom, actual
  response bytes checked independently. No mock analytics response is used.
- Actual in-app browser: real sign-in to `/admin`, Kadıköy mean **4.20 / 5 reviews**
  (A=5,5,5,5; B=1), unreviewed facilities retained, Adalar null/0 and no facilities.
  Both downloaded files had the Turkish filename; 7 matching district rows and
  identical scores were independently compared. CSV BOM/CRLF verified.
- Browser and integration test accounts/reviews/facilities were synthetic and
  private, and were removed afterwards. Actual municipal data is a separate task.

Required GitHub job `analytics-integration / verify` starts real SQL/Mongo and
rejects fewer than 39 passing cases or any skipped/error/failed test. The separate
`Admin panel live integration` workflow runs the mounted UI and requires its
JUnit evidence. These workflows are included for review; local success does not
claim they have already run on this commit or are required by branch protection.

Reproduce after migrations and `frontend/npm ci`, using your dedicated test DB
ports and the existing `SMARTLOO_DB_*` / `SMARTLOO_MONGO_URL` variables:

```powershell
$env:SMARTLOO_TEST_POSTGIS = '1'
$env:SMARTLOO_TEST_MONGO = '1'
python -m pytest tests/test_admin_analytics.py tests/test_admin_analytics_integration.py tests/test_requirements.py -q -k 'admin_analytics or tc_09 or tc_10 or tc_24 or tc_25 or tc_45'
python scripts/check_map_reviews_live.py --suite analytics
```

Remaining frontend contract/accessibility refinements are #64/#65; this PR does
not silently merge their branches or mark #61/#58 complete. Mobile, NVDA and
performance acceptance remain separate checks.
