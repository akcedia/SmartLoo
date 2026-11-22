# Local AI integration candidate — 22 November 2026

Status: **local review candidate, not published or deployed**. Built from main `d28502c` with the existing #68 head `90e1241`, Emir's #86 `b1a343c` and #87 `4e4a00d` merged locally. Component ownership remains Emir; Özgür prepared route/lifespan integration. No developer branch, main, public cloud settings, personal account or original local stage was modified.

## Component review

- #86 broadens three exact Turkish clauses, documents semantic reasons and changes policy/prompt cache identities while keeping the old opt-in profile name accepted. Independent initial focused run: 92 passed, 14 service-dependent skipped, 17 subtests passed. The skips were not counted as success. New usable-labelled acceptance is 9/12 rather than 6/12; the independent human language/privacy review remains pending. Do not present the restricted grammar as general Turkish acceptance.
- #87 adds a bounded Gemini reason provider and strict candidate/claim/sentence validation. Independent initial focused run: 42 passed, eight PostGIS cases skipped, eight subtests passed. The provider sends temporary refs and claim codes, not permanent IDs, exact location or user data. Inconsistent references, unknown claims, quota/timeout or invalid output preserve eligible candidates without invented reasons. The component deliberately did not wire itself into the HTTP route.

## Özgür's integration

Implementation commit: `a325f96`. The public recommendation endpoint now offloads existing synchronous PostGIS discovery, uses Emir's existing selection/reason component, and returns the agreed contract: verified per-result `reason`, `ai_reasons_available=true`, `fallback=false`, `message=null` only on success. Invalid provider responses keep the same eligible candidates with a labelled fallback. Discovery failure remains an error, not an empty success.

The route has a ten-second overall deadline including discovery; if a provider times out after discovery, the selected candidates remain. A shortened 0.15-second test exercises actual cancellation but is not a production latency measurement. Gemini summary/reason providers share a lifespan-owned HTTP client and remain opt-in. Missing configuration does not activate OpenAI or a paid fallback; startup/shutdown leave the reason provider cleared. Existing frontend reason rendering is reused; no second session/UI or new dependency was introduced.

The source's 432 real IBB records have unknown amenity/fee facts. A reason provider must skip those unsupported claims rather than inventing free/accessibility/baby-care facts. Passing synthetic verified-fact tests does not mean every real-source facility will acquire an AI reason.

## Test-first record and final local verification

- New HTTP-wiring test commit `b3a1439` ran before the implementation: **4 failed, 1 passed**. Failures showed that the endpoint never called the reason provider, never returned a verified reason and did not exercise provider cancellation. This is a genuine missing-feature test-first run, not an artificial rollback of completed code. Its original terminal output is retained in the session; no synthetic historical JUnit is fabricated.
- After implementation and expanded composition/real-PostGIS cases: **159 passed, 0 failures/errors/skips, 25 subtests passed**, one existing dependency deprecation warning. See [summary](evidence/ai-final-integration-2026-11-22/real-stores.json) and [JUnit](evidence/ai-final-integration-2026-11-22/real-stores.xml). The required JUnit guard with minimum 159 succeeded.
- Nine selected modules cover the new HTTP wiring, recommendation component, Gemini adapter, real nearby HTTP, real three-store summary/cache/revision behavior, Turkish acceptance guards, restricted policy, summary service and cloud route regression. Actual local PostgreSQL/PostGIS, MongoDB and Redis were used; external models were replaced by explicit test providers/fake HTTP. **Zero live model calls.**
- A fresh UUID SQL database on the local test service was migrated and then removed. Existing fixture cleanup uses unique Mongo databases and facility-scoped Redis keys without a global flush. Before dropping the owned SQL database, zero facilities/users/recovery records remained. No live 432-record store was used.
- Prepared AI CI additionally requires 41 HTTP/composition cases (previous 31 plus 10 wiring cases) and 14 recommendation-component cases. This updated workflow has not run on GitHub; its local component commands passed, not the entire hosted pipeline.

## Remaining review and release gates

Keep #68/#86/#87 draft until the agreed owner/human review and remaining acceptance are resolved. The combined local success does not authorize merging the components or deploying this candidate. Independent Turkish labels/paraphrase review, bounded native-model acceptance, final browser/mobile behavior and CI on the actual release candidate remain open. Full project coverage, Sonar/security/performance and Learn are separate. Do not merge #81 merely because an import integration test passed; its prior UI findings remain separate.

The implementation can be handed off for review without changing the running site. Any publication must identify the three component SHAs and separate Özgür's integration diff from their existing contributions.
