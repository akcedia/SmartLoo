# AI candidate with current map UI — 23 November 2026

Local review candidate only. Parents: AI PR #89 `68d5346` and main `92f1e7b`
(merged #81, #88, #90–92). No push, main merge, cloud AI activation or
checklist completion is implied by these results.

## Integration changes

- Preserve the new main map layout, theme/settings, language infrastructure and
  ADMIN import alongside the existing AI backend/provider contributions.
- Keep AI availability gating and unverified-reason suppression while adopting
  main's theme colors in the recommendation panel.
- Preserve both `--suite ai` and `--suite import` in the shared mounted-test
  runner, including private data cleanup and import advisory-lock behavior.
- Pass the map's selected radius to the recommendation panel. A new page-level
  regression first failed with expected `5000`, received `1000` (8 other layout
  tests passed). After the one-prop connection, it verifies the actual request
  uses 5000 m and refreshes to 500 m when the open panel's radius changes.
  This is a real integration regression, not native-model acceptance.

## Verification

- Frontend: **277 passed**, production build passed. Existing Node experimental
  localStorage warning remains; no rendered-device acceptance is inferred.
- Real local PostgreSQL/PostGIS, MongoDB and scoped Redis integration:
  **159 passed, 0 failures/errors/skips, 25 subtests passed**; required JUnit
  guard passed. One existing TestClient deprecation warning.
- Mounted React/API AI suite: **4 passed, 0 failures/errors/skips**.
- Mounted React/API ADMIN import suite: **1 passed, 0 failures/errors/skips**.
- A newly created UUID SQL database was migrated for this run and removed after
  zero facilities/users/recovery records were verified. Mounted fixtures use
  unique Mongo namespaces and scoped Redis keys. The public 432-record store
  and personal accounts were not used. **Zero live model calls.**
- Machine-readable evidence: [receipt](evidence/ai-ui-integration-2026-11-23/result.json),
  [backend JUnit](evidence/ai-ui-integration-2026-11-23/backend.xml),
  [AI mounted JUnit](evidence/ai-ui-integration-2026-11-23/ai-mounted.xml),
  [import mounted JUnit](evidence/ai-ui-integration-2026-11-23/import-mounted.xml).

## Remaining acceptance

Independent Turkish/privacy labels and paraphrase review, bounded native Gemini
acceptance, AI screen TR/EN completion and final mobile/browser acceptance remain
open. Do not invent amenity/fee facts for the source's unknown values. The hosted
checks on the old #89 head do not cover this unpublished candidate. Existing
logo work is isolated in `feature/app-icons` and is not part of this integration.
