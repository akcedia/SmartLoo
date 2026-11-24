# Independent #94 + #93 backend review — 24 November 2026

Local integration candidate from main `ed13074` (including #95), #94
`7df4c10f` and #93 `3324799e`. Fırat owns the services and migration;
Özgür prepared the combined route reconciliation and independent verification.
This record does not authorize a push, merge or cloud migration/deployment.

## Reconciliation and scope

Keep both facility-status and suggestion routers, initialize the existing
in-memory/PostgreSQL suggestion stores as designed, and remove both replaced
ADMIN 501 entries. Preserve main's auth/Sonar fix and existing import router.
No second implementation of either service was introduced.

Selected regression modules cover ADMIN status, suggestions/moderation, auth,
reviews/coordination/publication, account deletion, analytics, import, nearby and
cloud route behavior. These are 19 selected modules, not the entire test suite.

## Independent results

- **205 passed, zero failures/errors/skips**, one existing TestClient deprecation
  warning. Required JUnit evidence guard passed.
- A fresh UUID PostgreSQL/PostGIS database on the local test service received
  migrations 001–008 and the 13 synthetic facility seeds. MongoDB tests were
  enabled with local test connections. No cloud database or personal account
  was used, and no external model request was made.
- Coverage includes 401/403/422, unpublished pending/rejected suggestions,
  concurrent approvals yielding 200 + 409 and exactly one facility, account
  deletion clearing suggestion links, close/reopen behavior, review preservation
  and review-version change, and pending review recovery returning 503.
- Before dropping the private SQL database, it contained 13 seed facilities,
  14 test accounts, zero suggestions and zero review operations. These are
  explicit fixture leftovers, not a claim of zero rows. The entire private SQL
  database and the runner-owned root Mongo database were then removed.
  Some existing tests select their own Mongo namespaces; this receipt does not
  assert a server-wide Mongo cleanup.
- Separate unchanged requirements catalog: **45 passed / 7 failed / 0 skipped**
  across 52 instances. Newly passing conditions relative to the prior main
  baseline: TC-07, TC-18 and TC-27. Remaining failures: TC-08, both TC-15
  instances, TC-16, TC-17, TC-21 and TC-28. AI remains pending in this main-based
  candidate; TC-21 targets the API factory's placeholder home response and is
  not proof that the separately deployed frontend fails to load.
- [Regression JUnit](evidence/moderation-backend-2026-11-24/regression.xml),
  [catalog JUnit](evidence/moderation-backend-2026-11-24/catalog.xml),
  [runner receipt](evidence/moderation-backend-2026-11-24/result.json).

## Release dependencies

Suggested order after approval: #94, then the reconciled #93, followed by
#97/#98 frontend validation. Preserve branches and rerun hosted checks on each
actual head/main revision. Migration 008 must be applied through the existing
migration ledger before enabling suggestion/moderation routes on the cloud
database; it has not been applied to Neon by this review.

The user suggestion form, final merged frontend/browser acceptance and AI
acceptance are separate open work. Duplicate physical facilities still require
ADMIN review under the documented D-3 decision; there is no automatic duplicate
detection claim. No issue/board completion or instructor/Learn status changes.
