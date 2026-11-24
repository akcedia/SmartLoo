# Independent ADMIN UI integration — 24 November 2026

Local candidate: main `387236c` with #97 `07636e3` and #98 `df1b9c6`.
Onur owns the import translations and moderation/status screens. Özgür's
independent review adds delayed-response fixes and a reproducible mounted gate.
No GitHub update, merge, provider migration or cloud deployment is implied here.

## Review findings and fixes

The initial combined contribution passed **283 frontend tests** and its build.
Three new independent cases then failed before the fixes:

1. A delayed pending-page response appended pending cards to the approved tab
   and replaced its count after the user changed tabs.
2. A delayed successful status response for facility A reported an outcome and
   invoked the refresh callback after the user selected facility B.
3. The same stale outcome problem occurred with a failed status request.

Request-generation guards now discard responses from an obsolete tab/facility
or an unmounted component. Facility changes reset local busy/confirmation state.
Moderation status tabs are disabled while a decision is being submitted.
Already confirmed writes are not retried or falsely reported as cancelled.

After the fixes, **286 frontend tests passed**, including all three new cases,
and the production build passed. The Node localStorage experimental warning
remains separate from application behavior.

## Real local service checks

The shared mounted runner now supports `--suite moderation`; the existing import
and reviews modes remain. A dedicated Vitest configuration exercises actual
React controls, the shared session client and HTTP API, with a private migrated
PostgreSQL/PostGIS database and local MongoDB. It is jsdom, not a physical phone
or visual browser acceptance.

- Moderation: **1 multi-step test passed, zero failures/errors/skips**. Guest 401
  and USER 403; approval only after confirmation and exactly one UI PATCH;
  unknown source fields stay null; the approved facility appears in nearby
  search; rejection does not publish; a concurrent decision produces 409 and a
  retained notice after the refreshed pending list becomes empty.
- The same mounted scenario verifies that USER cannot see the facility-status
  control, ADMIN closes the facility, its existing review and average remain,
  and a new review on the closed facility is refused. Independent SQL checks
  verify suggestion statuses and `CLOSED` / `review_version=2`.
- Existing mounted import: **1 passed, zero failures/errors/skips**; published
  rows are exactly the two CSV and one JSON test rows.
- Existing mounted map/reviews: **9 passed, zero failures/errors/skips**.
- After every initial suite, SQL counts for facilities, users, suggestions and
  review operations were zero. The private SQL database was removed; the runner
  drops its uniquely named Mongo namespace. No public data/account or external
  model was used.

Receipts and JUnit: [evidence directory](evidence/admin-ui-2026-11-24/).
The final moderation test tightens the 409 wait to require the refreshed empty
list, rather than returning early while its loading state merely hides cards.
The moderation-only repeat is recorded separately from the initial three suites.

## Prepared CI and remaining acceptance

The existing map/reviews workflow gains a real moderation step and a required
JUnit gate (minimum one passing test, no failures/errors/skips), with an absolute
workspace artifact path. Both old and new receipts are uploaded. Hosted execution
on this candidate is pending and is not replaced by local success.

Recommended publication order after approval: #97, then #98 updated onto main
with these review fixes and evidence. Preserve both branches. Before any cloud
activation of the routes, apply migration 008 through the established ledger;
this review does not apply it to Neon.

Physical-device/mobile visual checks, the user suggestion form, remaining AI/user
screen translations, native AI acceptance, final report and #82 completion stay
separate. No checklist, teacher approval or Learn submission is claimed.
