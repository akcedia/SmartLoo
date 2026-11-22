# AI/main refresh and Gemini pilot preparation

## Sources and integration

On 22 November 2026, PR #83 was verified merged as main
`180a29442eac3d00500e5848aea41354366e4b88`. PR #68 remained draft at
`b753a124e4b40e2360cdb8b2ab90baa6ca82a0a5`. Emir requested preservation of both
AI routes and admin import when resolving the `src/app.py` conflict.

An independent local branch `integration/68-main-refresh` preserves Emir's
commits and merges current main. Merge commit `8222fe9` retains both router
registrations and the AI lifespan, adds a composition regression check, and
preserves #83's directory/nearby unknown-hours behavior. No existing author
branch was checked out for development or overwritten.

Özgür then selected the Gemini free tier. The added native provider reuses the
existing preparation/validation/coordinator pipeline and explicit opt-in;
[pilot configuration and limitations](../integration/gemini-free-pilot.md)
describe the separate private setup and single-request synthetic-only pilot.

## Local verification

- Merged backend (before adding the Gemini provider): **192 passed**, **41
  subtests passed**, 0 failed/errors/skips. Real PostgreSQL, MongoDB and Redis
  were used for the summary/recommendation/import suites. Each run used an
  isolated migrated SQL database on test port 5439, private Mongo identities and
  facility-scoped Redis cleanup. The JUnit gate independently reported 192
  passed and zero failures/errors/skips.
- Merged frontend: **165 passed** in 13 files with at most two workers;
  production build passed. Initial unrestricted worker startup failed for two
  files; it was not treated as a passing run.
- Gemini, OpenAI adapter and restricted-policy regression run: **51 passed**,
  **17 subtests passed**, fake HTTP only. The dedicated Gemini file then passed
  **17 tests**, 0 failures/errors/skips; its JUnit gate is now included in the
  prepared summary HTTP CI workflow. The independent Python 3.11/Redis-only
  unittest job retains its original dependency scope.
- Mounted AI/actual-store UI: initial default-forks run could not start its
  worker before the harness deadline. A single-thread retry ran all four cases:
  three passed and the multi-write/summary/edit flow hit Vitest's default
  five-second total test budget. The latter's functional test budget was changed
  to 20 seconds without altering per-route/provider deadlines or assertions.
  The next local run uses one Vitest thread and a 180-second harness startup/
  cleanup budget: **4 passed**, 0 failures/errors/skips. The summary/edit flow
  completed in 11.266 seconds overall, so this is functional evidence, not the
  separate search-latency acceptance target. Existing failed reports were kept.

Ignored raw JUnit files are retained in `.venv/ai-refresh/` including the failed
mounted attempts. Test counts and subtests are reported separately, not added
together as independent HTTP cases. The pre-existing TestClient deprecation
warning remains.

## Remaining boundaries

No Gemini API credential, paid resource or live model request was used in the
above checks. Free-project entitlement, actual model output and human Turkish
privacy/grounding acceptance must be verified separately. This work does not
complete all acceptance cases, #59 or #82.

`work-quality82` still holds the unpublished pool, container, quality and
packaging work. This main-based AI refresh does not silently fold that larger
change into Emir's PR. Its pool shutdown and AI client lifespan must be composed
together before deploying the combined candidate. The user's Docker site on
port 5082, account, 432 facilities and reviews were not replaced or reset.

Codex prepared the merge resolution, Gemini adapter, tests and local runners at
Özgür's request. GitHub changes, review, CI on this new commit, merge, teacher
approval and Learn submission remain separate and pending.

## Subsequent free-tier pilot

Özgür subsequently saved the key privately and confirmed Free tier in AI Studio.
Two controlled manual native-provider requests used only the same three
synthetic `Temizdi.` comments: the first timed out at eight seconds; the second
returned `Temiz.` and passed schema/restricted-policy validation. Both records
were retained; no automatic retry or paid-provider fallback occurred. The
intervening metadata-only GET returned HTTP 200 in 0.657 seconds, separately
from generation. See the [redacted live result](evidence/ai/gemini-free-pilot-2026-11-22.json).

The adapter/pilot guard suite now has **19 passed**, zero failures/errors/skips.
The two new guards prevent overwriting either existing attempt or making another
request before the report is checked. CI's prepared gate was raised to 19.
The real key remains ignored; the Docker site was not changed. A single accepted
synthetic output is not broad privacy/language, end-to-end live HTTP, performance
or instructor acceptance.
