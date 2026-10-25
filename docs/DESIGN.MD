# SmartLoo — Tasarım Belgeleri

Bu dosya tasarım katkılarının giriş noktasıdır. Ortak mimari ve sözleşme kararları ekip incelemesiyle kesinleşir.

- [Dış veri adapter’ı ve AI servis sözleşmesi](design/adapter-ai-contract.md) — #28; inceleme için tasarım önerisi. Veri dönüşümü, kaynak kimliği, AI girdi/çıktısı, fallback, cache ve mock senaryolarını kapsar.

Dayanaklar: [gereksinimler](REQUIREMENTS.MD), [analiz](ANALYSIS.MD) ve [ortak yapı görevi #23](https://github.com/akcedia/SmartLoo/issues/23).

Bu belgelerin bulunması, ilgili özelliklerin uygulanmış veya testlerinin geçmiş olduğu anlamına gelmez.
## 24 October integration decisions (Özgür, #23)

The review branch preserves contributor modules: `src/` backend, `frontend/` shared React host, `db/` migrations and `tests/` acceptance tests. Onur's host becomes the common frontend starting point; Furkan will add the discovery screen. No second frontend scaffold is needed.

```mermaid
flowchart TD
  Browser[React frontend] --> API[FastAPI routes]
  API --> Search[Search service]
  Search --> PG[PostgreSQL and PostGIS]
  API --> Reviews[Review and identity services - planned]
  Reviews --> Mongo[MongoDB - planned]
  API --> AI[AI adapter - planned]
  AI --> Cache[Redis - planned]
  AI --> Provider[External AI provider]
```

This diagram is the target architecture, not an implementation status claim. As of 25 October, GET /api/v1/toilets/nearby uses the local PostgreSQL/PostGIS store through src/nearby_store.py. Other feature routes remain pending and return 501. Public facility search does not require live IBB or AI access. Root Compose uses PostGIS 16-3.4 and SMARTLOO_DB_* variables to match Fırat's contribution. MongoDB/Redis remain planned and are not required for the current SQL checks.

### Search contract and implementation boundary
GET `/api/v1/toilets/nearby` accepts lat [-90,90], lon [-180,180], radius [1,50000] metres (default 1000), open_now and optional has_disabled_access/has_baby_changing/is_free booleans. Return `{count,results}` with UUID id, name, latitude, longitude and distance_m plus available metadata. Sort ascending by distance, then UUID for ties. Invalid parameters are 422; no matches is 200 with an empty list. Omitted amenities impose no constraint; unknown values match neither true nor false filters.

Use the SQL `nearby_toilets()` interface from db/migrations/002_nearby_toilets.sql for the production adapter. PR #35 implements the Python adapter and route integration and is merged into the weekly review branch. create_app accepts an explicit nearby_search provider; its default is the real SQL adapter. Isolated tests inject their own provider and real PostGIS integration tests exercise the default. Database connection failures return 503, with no automatic fallback to fixture data. The SQL connection uses SMARTLOO_DB_* process environment settings; .env is not loaded automatically.

With denied geolocation, use an explicit map viewport centre as the search origin and hide user-distance claims. open-only excludes unknown hours. The SQL parser currently supports 24/7 and a single time range; a richer schedule format requires a subsequent reviewed decision. Source administrative status is not evidence of opening hours.

### Admin contract review disposition
Q1: accept today plus previous 29 days in Europe/Istanbul. Q2: retain current no-limit proposal for now; define a tested resource limit before production. Q3: accept unknown district as 200/no data. Q4: retain the static district list for the labelled demo; a source-backed list is future work. Q5: retain one response for the demo; pagination/volume limits require production design. Q6: total includes all district facilities, active counts ACTIVE only, independent of review date selection. Q7: preserve API precision and display two decimals. These are integration recommendations pending team review, not claims of implemented backend contracts.

Review finding: the no-data example in admin-analytics-api.md omits the per-day null trend and zero-review facilities described above it. Resolve that distinction before implementing the analytics backend. Review/cache recovery, account deletion and repeated moderation remain open architectural decisions.

## Verification and next integration
See [weekly review](WEEKLY-2026-10-24.md). The search implementation has passed 10 isolated cases and 5 real PostGIS integration cases locally and in GitHub Actions. Next critical path: #23 shared-design review and remaining planning updates, #26 map connection to the implemented API, then #27 end-to-end validation. Issue #25 still includes a map-consumption acceptance condition, so backend implementation alone does not complete the entire issue. Large-dataset performance is not yet measured. PR #35 was merged by the owner after automated checks; no independent teammate approval was obtained. The 25 October demo is an internal target, not an instructor deadline. Formal design/test/code deadlines remain 15/22/30 November per the supplied syllabus.
