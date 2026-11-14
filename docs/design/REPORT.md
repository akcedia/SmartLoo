# SmartLoo — Software Design Report

**Course:** CMPE 331 · **Revision:** 0.4 for re-review · **Date:** 14 November 2026

**Team contact:** Özgür Kılıç

## 1. Design baseline

The [project Charter](../CHARTER.MD) defines the technology stack and milestones. The [approved requirements](../REQUIREMENTS.MD) and [analysis](../ANALYSIS.MD) define this release's scope. The release uses responsive web screens and preference-based facility recommendations. Native mobile delivery and turn-by-turn navigation are outside this release baseline. FR-08 specifies a signed, 60-minute JWT. The [UI Spec Lite](../analysis/ui-spec-lite.md) documents the existing screen designs and mockups.

| Evidence | Observed status |
| --- | --- |
| [`main` at `934a1eb`](https://github.com/akcedia/SmartLoo/tree/934a1ebdf4d714a9840fe17f0661b7e88757bd35) | Requirements and analysis are integrated. The default branch still contains the requirements-stage API scaffold at the stated revision. |
| [Weekly integration #36](https://github.com/akcedia/SmartLoo/pull/36) | The branch implements FastAPI/PostGIS nearby search and includes a sample-data admin dashboard, database migrations, and CI. Other feature API routes still return 501. Yeşim approved integration commit `6868c7c` on 14 November. The approved snapshot remains open for merge into main. [Branch CI](https://github.com/akcedia/SmartLoo/actions/runs/40190017447) passed the configured checks. |
| [Map PR #37](https://github.com/akcedia/SmartLoo/pull/37) | React/Leaflet map, filters and a facility detail card use mock data. Its replacement, [#54](https://github.com/akcedia/SmartLoo/pull/54), connects the shared frontend to live nearby search and is pending integration and independent verification. |
| [External data and AI contract](https://github.com/akcedia/SmartLoo/blob/9c5819f4f6f5b7108007cfbb1ef995e4d1e0a282/docs/design/adapter-ai-contract.md) | Proposed normalization, provider and cache contracts contributed by Emir Miraç İslamoğlu. Executable integration remains pending. |
| [Admin contract and panel #45](https://github.com/akcedia/SmartLoo/pull/45) | The contract and labelled sample adapter distinguish no facilities from facilities without reviews. The PR reports 38 frontend tests and a successful production build. |
| [Review-score reader #50](https://github.com/akcedia/SmartLoo/pull/50) and [account access #51](https://github.com/akcedia/SmartLoo/pull/51) | Separate open implementation PRs. The contributors report six MongoDB tests and nine PostgreSQL authentication tests. Shared MongoDB setup, live analytics, review ownership and account deletion remain pending. |

## 2. Architecture and interfaces

The [component diagram](arch/components.md) shows one React client with discovery and administration views, and one FastAPI service with separate responsibilities for discovery, account access, community data, administration, import, and AI. The deployment and persistence boundaries build on the [weekly design notes](https://github.com/akcedia/SmartLoo/blob/9c5819f4f6f5b7108007cfbb1ef995e4d1e0a282/docs/DESIGN.MD).

![Target architecture and component interfaces](images/architecture.png)

Solid arrows show the nearby-search path implemented on the weekly branch and the tile connection in the map prototype. Dotted arrows show planned integration or services.

| Boundary | Interface and responsibility |
| --- | --- |
| React → FastAPI | Versioned HTTP/JSON API. Discovery sends coordinates, radius and selected filters. Protected calls attach a Bearer token. Admin export returns CSV or JSON. |
| Discovery → PostGIS | Parameterized call to `nearby_toilets()` for the radius filter, amenity predicates and distance ordering. Discovery can serve search results while AI or external import is unavailable. |
| Account, community and administration → stores | Proposed data access boundaries follow the approved logical E-R model. Relational identity and facility references, review persistence, and cross-store consistency must be reconciled before implementation. |
| Import → İBB and PostgreSQL | Planned adapter reads facility GeoJSON and produces normalized candidates. A separate validated import operation writes facilities. Admin CSV/JSON import follows its own API contract. |
| AI → review access, Redis and provider | Planned review snapshot and summary cache. Only selected, redacted review text is sent to the provider. Provider timeouts fall back to existing statistics and a null summary. |

The [İBB adapter model](arch/ibb-geojson-adapter.md) describes the proposed GeoJSON normalization boundary. Candidates with unresolved source identity are held for review. The administrator's CSV/JSON batch import has a separate interface and rejects an invalid batch atomically with row-level errors.

![İBB GeoJSON adapter architecture](images/architecture-ibb-adapter.png)

[Deployment view](arch/deployment.md) records the current local Vite, FastAPI and Docker Compose PostGIS setup and the target HTTPS, service and private datastore boundaries. The target is a design for later deployment.

![Current local development deployment](images/deployment.png)

![Planned deployment and private datastore boundary](images/deployment-target.png)

## 3. Class model

The [nearby-search class diagram](class/nearby-search.md) represents the implemented route/adapter relationship on #36. The Python implementation uses functions, so the diagram models their interfaces and the request/result data types.

![Nearby-search class and interface model](images/class-nearby-search.png)

The [accounts and data class model](class/accounts-and-data.md) refines the approved E-R model for accounts, facilities, reviews and suggestions. It shows the store of each record, cardinalities, the one-review-per-user-and-facility rule, password hashing and which references the databases enforce. `Toilet` matches the implemented PostGIS migration. The account schema and access logic are proposed for integration in #51. The other records and cross-store coordination describe the target design.

![Accounts, facilities, reviews and suggestions class model](images/class-accounts-and-data.png)

The service view places the authorization boundary in FastAPI dependencies: `current_user` returns 401, while `require_admin` and `require_review_owner` return 403 for a valid session without the required role or ownership. The current-user and administrator guards are implemented on #51. #50 implements the review-score reader. The review-ownership guard remains a design proposal.

![Account access and authorization services](images/class-auth-services.png)

## 4. Dynamic models and coverage

| Approved use case | Sequence source | Modelled use-case elements |
| --- | --- | --- |
| UC-01 / FR-01 | [Nearby search](sequence/nearby-search.md) | Find nearby open facilities. |
| UC-02 / FR-02 | [Search filters](sequence/nearby-search.md) | Apply and clear amenity and price filters. |
| UC-03 / FR-03 | [Review lifecycle](sequence/review-lifecycle.md) | Create, edit and delete reviews with ownership and duplicate checks. |
| UC-04 / FR-04 | [AI summary](sequence/ai-summary.md), [recommendations](sequence/recommendations.md) | Read an AI summary and request preference recommendations. |
| UC-05 / FR-05 | [Suggestion and moderation](sequence/suggestion-moderation.md) | Suggest a new location, and approve or reject pending suggestions. |
| UC-06 / FR-06 | [Analytics](sequence/admin-analytics.md) | Inspect district and date-filtered analytics. |
| UC-07 / FR-07 | [Import](sequence/facility-import.md), [export](sequence/admin-analytics.md) | Import facilities and export reports. |
| UC-08 / FR-08 | [Account access](sequence/sign-in.md) | Register and sign in, with authorization boundaries. |
| UC-09 / FR-09 | [Map and details](sequence/map-details.md) | Browse markers and view facility details. |
| UC-10 / FR-10 | [Account deletion](sequence/account-deletion.md), [facility closure](sequence/facility-closure.md) | Delete an account, and close a facility while retaining reviews. |

The [approved PlantUML model](../requirements/use-cases.puml) defines 10 distinct use-case IDs and 12 elements. Each ID and element now has a sequence model (**10/10 IDs, 12/12 elements**). This is design coverage. Working implementation and test evidence are recorded separately in §1 and §5.

### Nearby search and filtering · UC-01 and UC-02

![Nearby search and filtering sequence](images/sequence-nearby-search.png)

### Map and facility details · UC-09

![Map marker selection and facility details sequence](images/sequence-map-details.png)

### Registration, sign-in and authorization · UC-08

![Registration sequence](images/sequence-registration.png)

The sign-in diagram shows the target Redis limiter. #51 currently stores the 15-minute window in PostgreSQL. The sequence for review ownership is a target model.

![Sign-in sequence](images/sequence-sign-in.png)

![Authorization of protected administrator requests](images/sequence-admin-authorization.png)

![Review ownership check for signed-in users](images/sequence-review-ownership.png)

### Account deletion · UC-10

![Account deletion and review anonymization sequence](images/sequence-account-deletion.png)

### Administrator analytics and export · UC-06 and UC-07

The React panel sends one district/date selection to both endpoints. FastAPI enforces the ADMIN role, resolves the inclusive Europe/Istanbul interval and computes the KPI, daily trend, facility table and export from the same individual reviews. Facilities come from PostgreSQL and reviews from MongoDB, because the stored all-time facility aggregate cannot be date-filtered. A selection without reviews returns null scores and keeps matched facilities; a selection without facilities returns an empty table. A review-store failure returns a server error instead of an empty result. The panel currently runs on a labelled sample adapter (#45). Both business endpoints remain placeholders. #51 supplies the guard and #50 supplies the reader on separate PRs. Live endpoints still need shared wiring and the analytics computation.

![Filtered administrator analytics sequence](images/sequence-admin-analytics.png)

![CSV and JSON report export sequence](images/sequence-admin-export.png)

### AI review summarization · UC-04

The [AI sequence](sequence/ai-summary.md) covers the cache, the 3–50 eligible review rule, redaction, output validation and statistics fallback. The service allocates the 10-second response budget across preparation, the provider call and fallback. Nearby search stays independent of the AI service.

![AI review summarization sequence](images/sequence-ai-summary.png)

### Review lifecycle · UC-03

![Review creation, editing and deletion](images/sequence-review-lifecycle.png)

### Preference recommendations · UC-04

![Preference-based facility recommendations](images/sequence-recommendations.png)

### Facility suggestion and moderation · UC-05

![Submit, approve or reject a facility suggestion](images/sequence-suggestion-moderation.png)

### Administrator facility import · UC-07

![Atomic CSV and JSON facility import](images/sequence-facility-import.png)

### Facility closure · UC-10

![Close a facility while retaining reviews](images/sequence-facility-closure.png)

## 5. Non-functional design decisions

| Requirement | Design decision | Verification method, target and status |
| --- | --- | --- |
| NFR-01 · Search latency | Use a PostGIS GiST index and `ST_DWithin` to limit candidates before sorting by distance. | SQL and pytest/PostGIS checks on #36 cover correctness. For NFR-T01, capture `EXPLAIN (ANALYZE, BUFFERS)` and run mixed search/filter load with 10,000 synthetic facilities and 50 concurrent clients. Warm up for one minute and measure for five minutes. Both mean and p95 must be <250 ms with zero unexpected non-2xx responses. Load measurement is pending. |
| NFR-02, NFR-07 · AI latency and API availability | Cache summaries, enforce a 10-second fallback deadline and keep nearby search independent of AI. | For NFR-T04, use pytest and a controllable provider stub. Measure 100 cache hits (p95 <100 ms) and 20 healthy uncached requests (p95 <8 s). Force timeout and verify that statistics and a null summary return by 10 s. For NFR-T06, disable AI and exercise search, filtering and details. Monitor the public API every minute for a calendar month against the 99% availability target. These measurements are pending. |
| NFR-03, NFR-04, NFR-08 · Security and privacy | Enforce roles server-side. Hash passwords with bcrypt cost ≥10 or Argon2, use signed 60-minute JWTs and deploy over HTTPS. Persist user coordinates only with explicit consent. Redact PII before provider calls and during account deletion as required. | For NFR-T02/T03/T07, use FastAPI and pytest to verify authentication, 401/403 role boundaries, input validation and unchanged state after rejection. Capture the provider request with synthetic PII, then inspect public responses and storage after denying location permission and deleting an account. Verify HTTPS and absence of secret/hash exposure. #51 reports authentication checks against PostgreSQL. Production HTTPS, account-deletion privacy and integrated authorization verification are pending. |
| NFR-05, NFR-06 · Map usability and accessibility | Provide a keyboard-operable results list, labelled controls and visible focus. Use the viewport center if geolocation is denied. | For NFR-T05, use axe and Lighthouse plus manual keyboard, focus and contrast checks at 360, 768 and 1920 px. Target WCAG 2.1 AA, Lighthouse accessibility ≥90 and zero serious or critical axe findings. Record the mobile network profile and measure initial map load (<2 s) and pan/zoom with 500 visible markers (≥30 FPS). These checks are pending. |
| NFR-09 · Maintainability | Run separate blocking CI checks for implemented features and retain the requirements baseline results. | On #36, GitHub Actions defines blocking search, SQL and frontend test/build jobs and publishes the non-blocking requirements baseline as JUnit. Use NFR-T08 to verify the lint, test and build gates and report backend branch coverage. The ≥80% backend coverage target and a separate lint gate remain pending. |
| NFR-10 · Interface language | Provide Turkish and English interface labels and identify AI summaries as Turkish. | For NFR-T09, switch languages in the map, authentication, errors and dashboard. Verify that labels change and selected filters are preserved. Verification is pending. |

## 6. Design review and delivery

- Finalize source identity and repeat-import behavior before enabling production İBB ingestion.
- Resolve retry and concurrency rules for review anonymization and AI cache invalidation across PostgreSQL and MongoDB.
- Validate the map against the shared search API and verify live analytics after the required backend changes are integrated.
- Review this revision in [PR #44](https://github.com/akcedia/SmartLoo/pull/44). Submit the PDF generated from the approved revision, with the diagrams embedded, through Learn by 15 November 2026.
