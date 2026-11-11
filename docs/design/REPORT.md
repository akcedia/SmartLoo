# SmartLoo — Software Design Report

**Course:** CMPE 331 · **Revision:** 0.2 for review · **Date:** 11 November 2026  
**Team contact:** Özgür Kılıç

## 1. Design baseline

The [project Charter](../CHARTER.MD) defines the technology stack and milestones. The [approved requirements](../REQUIREMENTS.MD) and [analysis](../ANALYSIS.MD) define this release's scope. The release uses responsive web screens and preference-based facility recommendations. Native mobile delivery and turn-by-turn navigation are outside this release baseline. FR-08 specifies a signed, 60-minute JWT. The [UI Spec Lite](../analysis/ui-spec-lite.md) documents the existing screen designs and mockups.

| Evidence | Observed status |
| --- | --- |
| [`main` at `934a1eb`](https://github.com/akcedia/SmartLoo/tree/934a1ebdf4d714a9840fe17f0661b7e88757bd35) | Requirements and analysis are integrated. The application is a requirements-stage API scaffold. |
| [Weekly integration #36](https://github.com/akcedia/SmartLoo/pull/36) | The branch implements FastAPI/PostGIS nearby search and includes a sample-data admin dashboard, database migrations, and CI. Other feature API routes still return 501. [Branch CI](https://github.com/akcedia/SmartLoo/actions/runs/40190017447) passed the configured checks. |
| [Map PR #37](https://github.com/akcedia/SmartLoo/pull/37) | React/Leaflet map, filters and a facility detail card use mock data. Integration with the shared frontend and live search remains pending. |
| [External data and AI contract](https://github.com/akcedia/SmartLoo/blob/9c5819f4f6f5b7108007cfbb1ef995e4d1e0a282/docs/design/adapter-ai-contract.md) | Proposed normalization, provider and cache contracts contributed by Emir Miraç İslamoğlu. Executable integration remains pending. |

## 2. Architecture and interfaces

The [component diagram](arch/components.md) shows one React client with discovery and administration views, and one FastAPI service with separate responsibilities for discovery, account access, community data, administration, import, and AI. The deployment and persistence boundaries build on the [weekly design notes](https://github.com/akcedia/SmartLoo/blob/9c5819f4f6f5b7108007cfbb1ef995e4d1e0a282/docs/DESIGN.MD).

![Target architecture and component interfaces](images/architecture.svg)

Solid arrows show the nearby-search path implemented on the weekly branch and the tile connection in the map prototype. Dotted arrows show planned integration or services.

| Boundary | Interface and responsibility |
| --- | --- |
| React → FastAPI | Versioned HTTP/JSON API. Discovery sends coordinates, radius and selected filters. Protected calls attach a Bearer token. Admin export returns CSV or JSON. |
| Discovery → PostGIS | Parameterized call to `nearby_toilets()` for the radius filter, amenity predicates and distance ordering. Discovery can serve search results while AI or external import is unavailable. |
| Account, community and administration → stores | Proposed data access boundaries follow the approved logical E-R model. Relational identity and facility references, review persistence, and cross-store consistency must be reconciled before implementation. |
| Import → İBB and PostgreSQL | Planned adapter reads facility GeoJSON and produces normalized candidates. A separate validated import operation writes facilities. Admin CSV/JSON import follows its own API contract. |
| AI → review access, Redis and provider | Planned review snapshot and summary cache. Only selected, redacted review text is sent to the provider. Provider timeouts fall back to existing statistics and a null summary. |

## 3. Class model

The [nearby-search class diagram](class/nearby-search.md) represents the implemented route/adapter relationship on #36. The Python implementation uses functions, so the diagram models their interfaces and the request/result data types. The domain model for accounts, reviews and moderation will be added to this section using the approved analysis model.

![Nearby-search class and interface model](images/class-nearby-search.svg)

## 4. Dynamic models and coverage

| Approved use case | Sequence model | Scope shown |
| --- | --- | --- |
| UC-01 / FR-01 | [Nearby search and filtering](sequence/nearby-search.md) | Nearby open facilities, input validation, no matches, database unavailable |
| UC-02 / FR-02 | [Nearby search and filtering](sequence/nearby-search.md) | Apply or clear amenities and price filters and refresh results |
| UC-09 / FR-09 | [Map and facility details](sequence/map-details.md) | Browse markers and request selected facility details, including the planned detail endpoint |
| UC-08 / FR-08 | [Registration and sign-in](sequence/sign-in.md) | Registration, sign-in, failure throttling, JWT issuance and role checks in the target design |

The [approved use case model](../requirements/use-cases.puml) defines 10 distinct UC identifiers and 12 use case elements. The initial sequences cover four distinct identifiers and four elements, or **40% by identifier and 33.3% by element**. Friday additions will expand coverage to AI, analytics and export. The count was checked against the PlantUML declarations and the linked sequence sources. Recalculate it after the team diagrams are integrated.

### Nearby search and filtering · UC-01 and UC-02

![Nearby search and filtering sequence](images/sequence-nearby-search.svg)

### Map and facility details · UC-09

![Map marker selection and facility details sequence](images/sequence-map-details.svg)

### Registration, sign-in and authorization · UC-08

![Registration sequence](images/sequence-registration.svg)

![Sign-in sequence](images/sequence-sign-in.svg)

![Authorization of protected administrator requests](images/sequence-admin-authorization.svg)

## 5. Non-functional design decisions

| Requirement | Design decision | Verification method, target and status |
| --- | --- | --- |
| NFR-01 · Search latency | Use a PostGIS GiST index and `ST_DWithin` to limit candidates before sorting by distance. | SQL and pytest/PostGIS checks on #36 cover correctness. For NFR-T01, capture `EXPLAIN (ANALYZE, BUFFERS)` and run mixed search/filter load with 10,000 synthetic facilities and 50 concurrent clients. Warm up for one minute and measure for five minutes. Both mean and p95 must be <250 ms with zero unexpected non-2xx responses. Load measurement is pending. |
| NFR-02, NFR-07 · AI latency and API availability | Cache summaries, enforce a 10-second fallback deadline and keep nearby search independent of AI. | For NFR-T04, use pytest and a controllable provider stub. Measure 100 cache hits (p95 <100 ms) and 20 healthy uncached requests (p95 <8 s). Force timeout and verify that statistics and a null summary return by 10 s. For NFR-T06, disable AI and exercise search, filtering and details. Monitor the public API every minute for a calendar month against the 99% availability target. These measurements are pending. |
| NFR-03, NFR-04, NFR-08 · Security and privacy | Enforce roles server-side. Hash passwords with bcrypt cost ≥10 or Argon2, use signed 60-minute JWTs and deploy over HTTPS. Persist user coordinates only with explicit consent. Redact PII before provider calls and during account deletion as required. | For NFR-T02/T03/T07, use FastAPI and pytest to verify authentication, 401/403 role boundaries, input validation and unchanged state after rejection. Capture the provider request with synthetic PII, then inspect public responses and storage after denying location permission and deleting an account. Verify HTTPS and absence of secret/hash exposure. Auth and privacy checks are pending. |
| NFR-05, NFR-06 · Map usability and accessibility | Provide a keyboard-operable results list, labelled controls and visible focus. Use the viewport center if geolocation is denied. | For NFR-T05, use axe and Lighthouse plus manual keyboard, focus and contrast checks at 360, 768 and 1920 px. Target WCAG 2.1 AA, Lighthouse accessibility ≥90 and zero serious or critical axe findings. Record the mobile network profile and measure initial map load (<2 s) and pan/zoom with 500 visible markers (≥30 FPS). These checks are pending. |
| NFR-09 · Maintainability | Run separate blocking CI checks for implemented features and retain the requirements baseline results. | On #36, GitHub Actions defines blocking search, SQL and frontend test/build jobs and publishes the non-blocking requirements baseline as JUnit. Use NFR-T08 to verify the lint, test and build gates and report backend branch coverage. The ≥80% backend coverage target and a separate lint gate remain pending. |
| NFR-10 · Interface language | Provide Turkish and English interface labels and identify AI summaries as Turkish. | For NFR-T09, switch languages in the map, authentication, errors and dashboard. Verify that labels change and selected filters are preserved. Verification is pending. |

## 6. Review items and final deliverable

- Reconcile the review-store boundary and the consistency approach for aggregates, AI cache invalidation and account deletion.
- Review the admin API's distinction between empty results, dates with missing values and facilities with zero reviews.
- Confirm the map-to-live-API boundary and model the AI and administrative interactions with their contributors.
- The review proof for commit `a794d90` was rendered and all seven embedded diagrams were checked for readability and page fit. Embed the reviewed diagrams in the final PDF and verify legibility and page fit. Generate it from the approved PR revision for Learn submission by 15 November.
