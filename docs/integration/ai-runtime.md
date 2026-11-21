# AI summary runtime integration (#61 / #59 / #68)

21 November 2026. Local integration proposal on main after #63 and #75.
This does not establish live-model acceptance or complete FR-04.

## Application behavior

`GET /api/v1/toilets/{uuid}/summary` uses the real review coordinator, SQL
revision/aggregates and Mongo documents. Unknown UUID returns 404, malformed
UUID 422, initial store failure or pending/repair state 503. The route has a
ten-second total budget including the initial guarded snapshot. Its generated
and cached text uses the same final publication guard as review writes.
Known author emails and display names are read in one bounded SQL batch and
redacted inside the guarded snapshot, before evidence preparation. These private
terms never enter the public snapshot or provider payload. The cache identity
includes this author-redaction policy version.

`create_app()` composes the existing `CoordinatedReviewRepository`,
`SummaryService`, `RedisSummaryCache` and `ReviewAICoordinator` rather than a
parallel review implementation. Application lifespan owns Redis/HTTP clients
and closes them on shutdown. Redis has one-second connect/socket timeouts,
no automatic retries and six-hour keys containing facility revision, language,
policy, model and prompt identities. Redis failure can return a validated fresh
result without caching; it never supplies revision authority.

No AI profile is enabled by default. With no configured provider, the route
returns `summary: null`, an unavailability/minimum-count message and the real
review count/average. It does not manufacture an AI summary.

## Nearby recommendation fallback

`GET /api/v1/recommendations` now calls the same real PostGIS discovery as
nearby search. Coordinates/radius/booleans follow its validation and filter
contract (radius defaults to 1000 m, maximum 50000 m). Only ACTIVE candidates
are eligible; unknown/closed source records remain available in the city
directory. Open-now requires an explicitly open schedule. Unknown amenities or
fees never match a requested true/false value.

Emir's existing selector returns at most three candidates, distance first, then
known cleanliness and stable ID for ties. No sentiment is invented. This is a
documented fallback policy for review, not a claim of personalised AI ranking.
The API retains actual names, coordinates and unknown values for detail selection.
It returns `ai_reasons_available: false`, `fallback: true` and a clear explanatory
message. No model is invoked and no AI reason is fabricated. Store failure is
503, not an empty result. Valid requests with no matches return an empty list.

The panel forwards the selected map radius, displays the fallback notice even
alongside results, and uses a normal nearby-facility title while AI reasons are
unavailable. It does not show unverified reason text. Aborted old requests cannot
replace newer radius/filter results. The existing sign-in screen restriction
is preserved; this endpoint retains the prior public route contract.

## Explicit settings

`SMARTLOO_REDIS_URL` defaults to `redis://127.0.0.1:6379/0` for a host process.
Use `redis://redis:6379/0` only for an app running in the Compose network.

The optional profile `SMARTLOO_AI_PROFILE=restricted-tr-evidence-v1` uses Emir's
**experimental finite Turkish grammar**. Unsupported input clauses, names or
instructions are excluded before the provider. Output must match the grounded
canonical grammar; unsupported paraphrases are rejected. This trades availability
for limited, inspectable coverage and is not general Turkish semantic/PII
validation. It remains opt-in and requires review before production selection.

Live configuration additionally needs a deliberate `SMARTLOO_AI_MODEL` and a
server-side `OPENAI_API_KEY`. No model was selected and no live request ran in
this integration. Keep keys outside Git, frontend variables, logs and reports.
The existing OpenAI adapter is used unchanged. Prompt/model calibration and
human evaluation are still needed; strict profile output can reject otherwise
valid model paraphrases.

Tests inject an async provider via `create_app(ai_provider=...,
ai_profile="restricted-tr-evidence-v1")`. That explicit test composition uses
the `injected-test-provider-v1` identity. Test helper `expected_candidate()` is
never the runtime model. Injected caches are caller-owned; application-created
clients are lifespan-owned.

## Three-store HTTP verification

Use migrated **test databases**, including migration 007, and explicit opt-in:

```powershell
$env:SMARTLOO_TEST_POSTGIS='1'
$env:SMARTLOO_TEST_MONGO='1'
$env:SMARTLOO_AI_TEST_REDIS_URL='redis://127.0.0.1:6379/15'
python -m pytest tests/test_summary_http.py -q --junitxml=summary-http.xml
python scripts/check_required_junit.py summary-http.xml --minimum 14
```

Set the usual SQL/Mongo host/ports for the test services. Each test provisions
private facility UUIDs, synthetic accounts and a separate Mongo database; Redis
cleanup deletes only keys containing that facility UUID, never flushes a shared
database. Fourteen cases cover real HTTP cache hits/six-hour TTL, private evidence,
revision invalidation, score retention after account deletion, edit/deletion
during generation or during a real Redis hit, durable repair across restart, Redis outage, missing model,
unsupported personal text, known author names even when they match the allowed
grammar, input/store errors and actual provider cancellation
at the ten-second deadline. The provider is synthetic throughout.

`AI summary HTTP integration` starts PostGIS/Mongo/Redis and requires at least
30 HTTP successes (14 summary + 16 recommendation) and four mounted React
successes with no errors/failures/skips. Run both backend suites with
`python -m pytest tests/test_summary_http.py tests/test_recommendation_http.py -q`.
The mounted checks use `python scripts/check_map_reviews_live.py --suite ai`,
requiring frontend `npm ci` and the same test database opt-ins. They check summary
refresh after edit, real nearby fallback selection/coordinates, empty area and
unknown fee exclusion. Their model is explicitly synthetic. These are jsdom
interaction checks with actual HTTP/stores, not visual browser/mobile acceptance.
Existing isolated AI and real
Redis component suites remain separate. No branch-protection configuration is
changed by adding this job.

## Remaining acceptance

- Live model selection, credentials, prompt alignment and human-labelled Turkish
  privacy/language/grounding evaluation.
- Final ranking acceptance and optional validated AI reasons.
- Visual/browser/mobile acceptance after the mounted HTTP integration.
- Report refresh, staging performance/security/SonarQube evidence and Learn
  submission confirmation remain separate from this integration.

Keep #68 draft until its agreed acceptance is met. Unit/component successes,
local three-store verification, GitHub CI, merge and academic submission are
different milestones.
