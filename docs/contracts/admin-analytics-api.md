# Admin analytics API contract (draft)

Owner: Onur Arda Buldağ (issue [#29](https://github.com/akcedia/SmartLoo/issues/29)). Backend reviewer: Özgür Kılıç. Version 0.1, 19 October 2026.
Covers FR-06 and FR-07 export. Baseline: [REQUIREMENTS.MD §3.6, §3.7, §8](../REQUIREMENTS.MD), [dashboard-import-export.md](../analysis/behavior/dashboard-import-export.md), [UI Spec Lite — Administration](../analysis/ui-spec-lite.md).

**Status: DRAFT — not yet reviewed by the backend owner.** Fields marked *required* are already fixed by the requirements and the HTTP contract tests (TC-09, TC-10, TC-24, TC-25). Fields marked *proposed* are what the admin panel skeleton needs; they become binding only after review with Özgür. This document does not change [src/app.py](../../src/app.py) or the tests; both endpoints still return 501.

## 1. Shared rules

| Topic | Rule | Source |
|---|---|---|
| Authorization | `Authorization: Bearer <JWT>`. Missing/invalid/expired token → 401; valid USER → 403; only ADMIN reads metrics or exports. | §3.8, auth-account.md |
| Hiding the route is not security | The frontend hides the dashboard for non-ADMIN users only for convenience. The backend RBAC check above is the only protection. | #29 |
| Query parameters | `district`, `from`, `to` (and `format` for export). Same names, same meaning on both endpoints. | §8 API table |
| `district` | Optional. Omitted means all districts. Exact Turkish name as stored in `Toilet.district` (e.g. `Kadıköy`). | dashboard-import-export.md §1 |
| `from`, `to` | `YYYY-MM-DD` calendar dates, both **inclusive**, interpreted in **Europe/Istanbul**. Implemented as the half-open interval `[from 00:00, (to + 1 day) 00:00)` Istanbul time. | §3.6 |
| Date field | Filter applies to `Review.created_at`. | D-5 resolved |
| Defaults | If `from`/`to` are omitted: last 30 calendar days, i.e. `from = today − 29 days`, `to = today` (Istanbul). *Proposed interpretation — see Q1.* | §3.6 |
| Invalid input | Non-date strings, or `from > to` → 422 with the canonical FastAPI validation body naming the field. | §1 decision table |
| Unknown district | 200 with the no-data shape (not 404). *Proposed — see Q3.* | — |

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

### 2.3 Example — no data (TC-25)

```json
{
  "filters": { "district": null, "from": "2026-09-20", "to": "2026-10-19", "timezone": "Europe/Istanbul" },
  "average_cleanliness": null,
  "review_count": 0,
  "critical_alert": false,
  "critical_threshold": 3.5,
  "active_facility_ratio": null,
  "trend": [],
  "facilities": []
}
```

### 2.4 Why the overall mean is review-weighted

Facility A has reviews 5, 5, 5, 5 and facility B has one review of 1. Review-weighted mean = 21 / 5 = **4.2** (correct). Mean of facility means = (5 + 1) / 2 = **3.0** (wrong — it would raise a false critical alert). The panel never recomputes the KPI from table rows.

## 3. `GET /api/v1/admin/analytics/export`

Parameters: `format` (`csv` | `json`, required), plus the same `district`, `from`, `to` as the summary. The panel always sends the filters currently shown on screen, so the export describes the same selection as the dashboard.

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
- `Content-Disposition: attachment; filename="smartloo-hygiene-<district|all>-<from>_<to>.csv"` (*proposed filename pattern*).

```csv
facility_id,district,hygiene_score,open_issues_count,last_cleaned_at
00000000-0000-4000-8000-000000000001,Kadıköy,3.0,,
```

### 3.3 JSON

`Content-Type: application/json`. `results` is required (TC-24); `filters` and `count` are proposed.

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

## 5. Open questions for the backend owner (Özgür)

| ID | Question | Panel assumption until answered |
|---|---|---|
| Q1 | “Last 30 calendar days” = today and the 29 days before (inclusive)? | Yes. |
| Q2 | Is there a maximum interval length, and may `to` be in the future? | No limit; client only checks format and `from ≤ to`. |
| Q3 | Unknown district → 200 no-data or 422? | 200 no-data. |
| Q4 | Where does the district list come from (static 39 Istanbul districts vs. distinct `Toilet.district`)? | Static list of 39 districts in the frontend. |
| Q5 | Should `trend`/`facilities` be part of the summary response or separate endpoints? | Part of the summary (one request, one selection). |
| Q6 | Should `active_facility_ratio` count CLOSED and MAINTENANCE in `total`? | `total` = all facilities in district, `active` = ACTIVE. |
| Q7 | Rounding: does the API round `average_cleanliness`? | API returns full precision; UI shows 2 decimals. |

## 6. Not covered / not claimed

- Both endpoints still return 501. The panel runs on a clearly labelled **sample adapter**; there is no live backend integration in this task (tracked separately).
- Authentication and RBAC are not implemented. The panel's role switch is a demo control, not security.
- Import (`POST /api/v1/admin/import`), moderation and facility status tabs are out of scope for #29.
