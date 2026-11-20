# Review data and revision contract (FR-03, FR-04, FR-06, FR-10)

Owner: Fırat Karadoğan ([#56](https://github.com/akcedia/SmartLoo/issues/56)). For Özgür (route registration, details, analytics) and Emir (AI summary). Data rules come from the [class model](../design/class/accounts-and-data.md) and [er-data-dictionary.md](../analysis/data/er-data-dictionary.md).

**Status (21 November).** `read_review_scores()` is merged through [#50](https://github.com/akcedia/SmartLoo/pull/50). Review CRUD, viewer permissions and the guarded operation lifecycle (migrations 004/005) are implemented. Account deletion in #75 shares this journal and adds the pending-author index (migration 007). The AI bridge was tested with #68's actual consumer and real PostgreSQL/MongoDB/Redis using a synthetic provider and policies. Public AI routes and a live model remain separate integration work.

## Implemented: scores for analytics

```python
from src.review_scores import ReviewStoreError, read_review_scores, review_collection

read_review_scores(review_collection(), toilet_ids, start_utc, end_utc)
# -> [{"toilet_id": "<uuid>", "created_at": datetime(UTC), "cleanliness_score": 1..5}, ...]
```

Start inclusive, end exclusive, both timezone-aware; oldest first. No match → `[]`. MongoDB unreachable → `ReviewStoreError` (route answers 503, never an empty result). No comment text or user identity is returned. Anonymized reviews (author deleted) still count.

## Decision proposal: review revision (cache invalidation)

Proposed in [#28](https://github.com/akcedia/SmartLoo/issues/28#issuecomment-6400782736); to be confirmed in #56.

- `toilets.review_version bigint NOT NULL DEFAULT 0` in PostgreSQL (migration 004, owned by Fırat).
- Every successful review create, edit or delete, account deletion that touches a toilet's reviews, and closing a toilet increments it in the **same PostgreSQL transaction** that recalculates `average_cleanliness` and `review_count`.
- The AI summary cache key includes it, e.g. `summary:{toilet_id}:v{review_version}:{lang}:{contract}:{policy}`. A shared guarded snapshot supplies the version, texts and true totals. The same guard checks ready state and version during final publication, including cache hits.
- Old keys expire by their 6-hour TTL; nothing has to delete them, so a Redis outage cannot leave a stale summary marked current.

## Review service (`src/reviews.py`)

### Viewer permissions

`GET /toilets/{toilet_id}/reviews` is public. With a valid Bearer token it resolves
the current account and returns `is_own`, `can_edit` and `can_delete` for that
viewer. An author can edit/delete their review. An ADMIN can delete another
author's review. Guests and other users cannot change it. Responses omit
`user_id`. A supplied invalid, expired or deleted-account token returns 401.

The write endpoints enforce their own permissions independently of these flags.

`ReviewService` is created once as `app.state.reviews`; its router is included in `src/app.py` (Özgür owns that file; the change is two lines). Other modules call the service, they do not reimplement it.

| Method | Route | Results |
| --- | --- | --- |
| `list(toilet_id, limit=20, offset=0, principal=None)` | `GET /toilets/{id}/reviews` | 200 `{count, results}`, newest first; each result includes viewer `is_own`, `can_edit`, `can_delete`; author is the display name or `"Anonymous"`; 404 unknown toilet; 503 while a review operation needs recovery |
| `create(principal, toilet_id, ReviewIn)` | `POST /toilets/{id}/reviews` | 201 review; 401 guest; 404 toilet missing or `CLOSED`; 409 `"You have already reviewed this toilet. Edit your existing review."`; 422 score not an integer 1–5, comment over 1000 characters, unknown tag |
| `update(principal, review_id, ReviewPatch)` | `PATCH /reviews/{id}` | 200 review; 403 not the author (also for ADMIN); 404; 422 empty or invalid change |
| `delete(principal, review_id)` | `DELETE /reviews/{id}` | 204; 403 neither author nor ADMIN; 404 |
| `eligible_for_summary(toilet_id, limit=50)` | legacy summary reader | The existing `{review_version, reviews}` shape, with a guarded read; 503 when busy or dirty |
| `read_summary_snapshot(toilet_id, limit=50)` | internal synchronous reader | Protocol 1 envelope with `ready/busy/writing/repair_required`, operation ID, real total count/average, version and at most 50 commented reviews; dirty states expose no text |
| `reconcile(toilet_id)` | maintenance | Restore a pending mutation's prior document, recompute totals and advance the version once; repeating completed recovery returns the same version |

Tags (proposal, FR-03 only names examples): `clean`, `dirty`, `smelly`, `well-lit`, `no-soap`, `no-paper`, `no-water`, `out-of-order`.

**Visibility policy.** There is no hidden or moderated state in this release: a review is either public or deleted (hard delete by its author or an ADMIN, REQ-SEC-05). After account deletion a review stays public as `"Anonymous"` with redacted text (FR-10, implemented separately).

For details and analytics (Özgür): `average_cleanliness`, `review_count` and `review_version` on the PostgreSQL `toilets` row are always current after a successful review response.

Every successful change returns only after PostgreSQL has the new average, count and `review_version` (REQ-DB-05, TC-26, TC-35).

### Guarded writes and recovery

Migration 005 adds `review_operations`. A dedicated PostgreSQL session acquires
a facility advisory lock before validation and Mongo mutation. It commits an
operation ID and private before-document first. Mongo changes next. The same SQL
session atomically commits recomputed aggregates, one version increment and
removal of the operation record. Lock acquisition waits at most two seconds;
SQL statements use a five-second timeout.

Review mutations first acquire account guards for the actor and original author,
in sorted order, and recheck the actor's existence and current role. Account
deletion takes the same guard. The facility journal borrows that same SQL session,
so connection loss releases both guards together. Migration 007 stores `author_id`
even for a pending creation whose before-document is null. Deletion refuses any
pending author operation, including partial anonymization with no Mongo author
link. The account/history SQL transaction runs last, after all author documents
and recovery markers have been cleared. Account guards wait at most two seconds.

On failure, compensation restores the old Mongo document (or removes a newly
created document), verifies it, then clears the marker under the same guard.
If rollback fails or the SQL session is lost, the durable marker remains. New
writes and public review listing return 503 while that facility requires repair.
AI reads return no text and the last committed totals. Metadata-store failure
remains an error. Private before-documents are never returned or logged.

Recovery uses the same guard and the stored before-document. It restores and
verifies Mongo, then atomically recomputes totals, advances the revision and
clears the marker. A crash during recovery leaves the record for the next retry.
After a completed recovery, retrying leaves the version unchanged.

For a known affected facility, an operator can run from the repository root,
with the normal database/Mongo environment configured:

```sh
python -c "from src.app import create_app; print(create_app().state.reviews.reconcile('FACILITY_UUID'))"
```

### AI publication integration

`app.state.review_ai_coordinator` implements the async port proposed in #68.
After #68 is integrated, pass it to `CoordinatedReviewRepository`. Its snapshot
returns the actual #68 `SummarySnapshot`. Its publication method returns the
actual `SummaryPublication`; busy, dirty and stale candidates never invoke the
callback. Generated results and cache hits use the same path. OpenAI generation
runs outside the guard; only bounded cache/response work runs inside it.

The callback has a two-second budget. A worker owns the synchronous SQL session
and guard; the callback runs on the caller's event loop. Cancellation waits for
the worker to close its session. Windows requires no event-loop policy change.

Account anonymization uses this same guard/pending lifecycle. Future facility
closure and direct Mongo analytics readers must honor it when integrated. Those
future paths are separate work from account deletion. The downstream AI
privacy/language/evidence policies remain required after initial redaction.

### Verification of the guarded lifecycle

Windows / Python 3.13, PostgreSQL/PostGIS 16-3.4, MongoDB 7.0:

```sh
SMARTLOO_TEST_POSTGIS=1 SMARTLOO_TEST_MONGO=1 python -m pytest tests/test_reviews.py tests/test_review_consistency.py tests/test_review_publication.py tests/test_reviews_integration.py -q
```

35 cases passed with zero failures/errors/skips. Seven use real PostgreSQL and
MongoDB, including concurrent edit/delete, failed SQL plus failed undo, actual
server-side session termination and failure after an SQL UPDATE before commit.
The 28 isolated cases include cancellation, callback error, actual two-second
publication deadline and repeat recovery. The publication unit tests stub only
the external #68 envelope types. A separate run of 64 auth, detail, nearby,
input-safety and Mongo score-reader regressions passed.

A temporary integration composed #68 `d9fa94df`'s actual
`CoordinatedReviewRepository` and `SummaryService` with this real coordinator,
PostgreSQL, MongoDB and Redis 7.4. Generated output, cache hit/six-hour TTL,
edit-during-generation rejection, busy suppression, publication cancellation,
stale-version rejection and callback-error lock release passed. This run used
the Windows default event loop and a synthetic provider/privacy/validator.
It did not call OpenAI or validate public AI HTTP routes or production policies.

The CI `reviews-integration` job starts both real databases and requires all
35 review cases with no skips through the existing JUnit gate.
