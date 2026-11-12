# Administrator analytics and report export · UC-06 and UC-07

Target model for FR-06 and the export part of FR-07, based on the [admin analytics API contract](https://github.com/akcedia/SmartLoo/blob/d404deb4/docs/contracts/admin-analytics-api.md) revised in #45. Contributor: Onur Arda Buldağ (#40). CSV/JSON facility import is outside these diagrams; its adapter boundary is modelled with #39.

Both diagrams use the same three boundaries:

| Boundary | Responsibility |
| --- | --- |
| React admin panel | Holds the district/date selection, validates date format and order, cancels obsolete requests and renders KPI, trend, table, export and error states. The same selection is sent to summary and export. |
| FastAPI admin routes and analytics service | Enforce ADMIN authorization server-side, validate the query, resolve default dates and the Europe/Istanbul interval, and compute every view from one set of eligible reviews. |
| Data queries | PostgreSQL supplies facilities, district and administrative status. MongoDB supplies individual reviews selected by facility UUID and `created_at`. The stored all-time facility aggregate is not used, because it cannot be date-filtered. |

## Filtered hygiene analytics · UC-06 / FR-06

```mermaid
sequenceDiagram
    actor Admin as Administrator
    box Client
        participant UI as React admin panel
    end
    box FastAPI service
        participant API as Admin routes
        participant Auth as Account access service
        participant Svc as Admin analytics service
    end
    box Data stores
        participant Fac as Facility repository (PostgreSQL)
        participant Rev as Review reader (MongoDB)
    end

    Admin->>UI: Open Analytics or change district / dates
    UI->>UI: Check YYYY-MM-DD format and from ≤ to
    alt Invalid selection
        UI-->>Admin: Field error next to the dates, no request sent
    else Valid selection
        UI->>UI: Abort the previous summary request
        UI->>API: GET /api/v1/admin/metrics/summary?district&from&to with Bearer token
        API->>Auth: Validate signature, expiry and role
        alt Token missing, expired or invalid
            Auth-->>API: Authentication rejected
            API-->>UI: 401
            UI-->>Admin: Sign-in required, no analytics shown
        else Valid token without ADMIN role
            Auth-->>API: Insufficient role
            API-->>UI: 403
            UI-->>Admin: Administrators only, no analytics shown
        else ADMIN
            Auth-->>API: Authorized identity
            alt One date boundary missing, non-date value or from > to
                API-->>UI: 422 naming the field
                UI-->>Admin: Date validation message, filters kept
            else Valid query
                API->>Svc: summary(district, from, to)
                Svc->>Svc: Default to today and previous 29 days if both dates omitted
                Svc->>Svc: Interval [from 00:00, to + 1 day 00:00) Europe/Istanbul
                Svc->>Fac: Facilities in district with administrative status
                Fac-->>Svc: Matched facilities (possibly none)
                alt No matched facilities
                    Svc-->>API: Null average, count 0, alert false, null trend days, facilities [], ratio null
                    API-->>UI: 200 summary
                    UI-->>Admin: No-data KPI and empty facility table
                else Facilities matched
                    Svc->>Rev: Reviews with toilet_id in facility UUIDs and created_at in interval
                    alt Review store unavailable
                        Rev-->>Svc: Query failure
                        Svc-->>API: Server error, never an empty result
                        API-->>UI: 5xx
                        UI-->>Admin: Error with Retry, filters kept
                    else Reviews returned (possibly none)
                        Rev-->>Svc: Individual eligible scores
                        Svc->>Svc: Mean of individual scores, null if none
                        Svc->>Svc: Alert only if mean < 3.5, daily trend with null days
                        Svc->>Svc: Facility rows with period score, null for zero reviews
                        Svc-->>API: Summary with filters echo, ratio of ACTIVE facilities
                        API-->>UI: 200 summary
                        UI-->>Admin: KPI, critical alert, trend and facility table
                    end
                end
            end
        end
    end
```

## CSV and JSON report export · UC-07 / FR-07

```mermaid
sequenceDiagram
    actor Admin as Administrator
    box Client
        participant UI as React admin panel
    end
    box FastAPI service
        participant API as Admin routes
        participant Auth as Account access service
        participant Svc as Admin analytics service
    end
    box Data stores
        participant Fac as Facility repository (PostgreSQL)
        participant Rev as Review reader (MongoDB)
    end

    Admin->>UI: Choose Export CSV or Export JSON
    UI->>API: GET /api/v1/admin/analytics/export?format&district&from&to (selection on screen)
    API->>Auth: Validate token and ADMIN role
    alt Not authenticated or not ADMIN
        Auth-->>API: Rejected
        API-->>UI: 401 or 403
        UI-->>Admin: Export not available, no file created
    else ADMIN
        Auth-->>API: Authorized identity
        alt format not csv or json, or invalid dates
            API-->>UI: 422 naming the field
            UI-->>Admin: Export error message
        else Valid request
            API->>Svc: exportRows(district, from, to)
            Note over Svc: Same filter resolution and Istanbul interval as the summary
            Svc->>Fac: Facilities with open_issues_count and last_cleaned_at
            Fac-->>Svc: Matched facilities (possibly none)
            alt Facilities matched and review store unavailable
                Svc->>Rev: Eligible reviews for those facilities and the interval
                Rev-->>Svc: Query failure
                Svc-->>API: Server error, no partial file
                API-->>UI: 5xx
                UI-->>Admin: Export failed, filters kept
            else Reviews loaded, or no facility to query
                opt At least one facility
                    Svc->>Rev: Eligible reviews for those facilities and the interval
                    Rev-->>Svc: Individual eligible scores (possibly none)
                end
                Svc->>Svc: One row per facility, hygiene_score null without reviews
                Svc->>Svc: Missing operational values stay null, never inferred
                Svc-->>API: Rows with five fixed columns (possibly none)
                alt format = csv
                    API->>API: UTF-8 BOM, RFC 4180 quoting, CRLF, blank for null
                    API-->>UI: 200 text/csv with Content-Disposition filename
                else format = json
                    API-->>UI: 200 application/json with filters, count and results
                end
                UI->>UI: Save the response with the server filename
                UI-->>Admin: Downloaded report
            end
        end
    end
```

An empty facility selection still returns 200: a CSV containing only the header row, or JSON with `count: 0` and `results: []`.

## Contract decision: empty results, null days and facilities without reviews

The open question from the first contract is decided as follows (contract §2.3, §3 and §5, reviewed in #45):

| Situation | Summary | Export |
| --- | --- | --- |
| Facilities matched, no reviews in the period | `average_cleanliness: null`, `review_count: 0`, `critical_alert: false`. Every selected day appears in `trend` with a null average and count 0. Every matched facility stays in `facilities` with `hygiene_score: null`. The ACTIVE ratio stays available. | One row per facility with a blank (CSV) or null (JSON) `hygiene_score`. |
| No matched facilities (including an unknown district) | Same null KPI and daily trend, `facilities: []`, `active_facility_ratio: null`. Still 200, not 404. | Header-only CSV; JSON `count: 0`, `results: []`. |
| Some days without reviews | Those trend rows have a null average and count 0; the chart leaves a gap and never plots 0. | Not applicable. Export is one row per facility. |
| Review store unavailable | Server error. An empty result is reserved for a successful query, so the panel shows Retry rather than “No data”. | Server error; no partial file. |

## Implementation status

| Part | Status |
| --- | --- |
| React admin panel with the states above | Implemented with a labelled sample adapter in #45 (`weekly-review-2026-10-24` base). 38 frontend tests pass, including both empty cases; verified in the browser for this report. |
| HTTP adapter for both endpoints | Written in the panel but not connected. |
| `GET /api/v1/admin/metrics/summary`, `GET /api/v1/admin/analytics/export` | Return 501. Depend on server-side ADMIN authorization (#38) and a MongoDB review reader. |
| Account access service, review reader | Target components; not yet implemented. |
