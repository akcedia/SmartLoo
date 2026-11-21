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
review count/average. It does not manufacture an AI summary. The recommendations
route remains separate pending work.

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
fourteen successes with no errors/failures/skips. Existing isolated AI and real
Redis component suites remain separate. No branch-protection configuration is
changed by adding this job.

## Remaining acceptance

- Live model selection, credentials, prompt alignment and human-labelled Turkish
  privacy/language/grounding evaluation.
- Recommendation API wiring, agreed ranking and optional validated AI reasons.
- Mounted frontend with the summary HTTP runtime, plus visual/mobile acceptance.
- Report refresh, staging performance/security/SonarQube evidence and Learn
  submission confirmation remain separate from this integration.

Keep #68 draft until its agreed acceptance is met. Unit/component successes,
local three-store verification, GitHub CI, merge and academic submission are
different milestones.
