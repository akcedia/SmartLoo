# Review data and revision contract (FR-03, FR-04, FR-06, FR-10)

Owner: Fırat Karadoğan ([#56](https://github.com/akcedia/SmartLoo/issues/56)). For Özgür (route registration, details, analytics) and Emir (AI summary). Data rules come from the [class model](../design/class/accounts-and-data.md) and [er-data-dictionary.md](../analysis/data/er-data-dictionary.md).

**Status (17 November).** `read_review_scores()` ([#50](https://github.com/akcedia/SmartLoo/pull/50)), the review service and migration 004 are implemented and tested on real PostgreSQL + MongoDB. Facility details, the AI summary route and account deletion are not part of this change.

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
- The AI summary cache key includes it, e.g. `summary:{toilet_id}:v{review_version}:{lang}:{contract}:{policy}`. Emir reads the version before calling the provider and again before publishing; if it changed, the result is not published or cached.
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
| `list(toilet_id, limit=20, offset=0)` | `GET /toilets/{id}/reviews` | 200 `{count, results}`, newest first; each result `{id, toilet_id, author, cleanliness_score, comment, tags, created_at, updated_at, is_own}`; author is the display name or `"Anonymous"`; 404 unknown toilet |
| `create(principal, toilet_id, ReviewIn)` | `POST /toilets/{id}/reviews` | 201 review; 401 guest; 404 toilet missing or `CLOSED`; 409 `"You have already reviewed this toilet. Edit your existing review."`; 422 score not an integer 1–5, comment over 1000 characters, unknown tag |
| `update(principal, review_id, ReviewPatch)` | `PATCH /reviews/{id}` | 200 review; 403 not the author (also for ADMIN); 404; 422 empty or invalid change |
| `delete(principal, review_id)` | `DELETE /reviews/{id}` | 204; 403 neither author nor ADMIN; 404 |
| `eligible_for_summary(toilet_id, limit=50)` | for Emir | `{review_version, reviews: [{id, cleanliness_score, comment, created_at}]}`, newest first, only reviews with a comment, emails and phone numbers replaced by `[removed]`, no user ids |
| `reconcile(toilet_id)` | maintenance | recompute one toilet's aggregates from MongoDB after an interrupted request |

Tags (proposal, FR-03 only names examples): `clean`, `dirty`, `smelly`, `well-lit`, `no-soap`, `no-paper`, `no-water`, `out-of-order`.

**Visibility policy.** There is no hidden or moderated state in this release: a review is either public or deleted (hard delete by its author or an ADMIN, REQ-SEC-05). After account deletion a review stays public as `"Anonymous"` with redacted text (FR-10, implemented separately).

For details and analytics (Özgür): `average_cleanliness`, `review_count` and `review_version` on the PostgreSQL `toilets` row are always current after a successful review response.

Every successful change returns only after PostgreSQL has the new average, count and `review_version` (REQ-DB-05, TC-26, TC-35).

**Consistency approach.** MongoDB is written first, then the PostgreSQL aggregates are **recomputed from MongoDB** for that toilet (not incremented), together with the version bump. Recomputing is idempotent, so a retry after any partial failure gives the same result. If the PostgreSQL step fails, the MongoDB change is undone (restore the previous document or delete the new one) and the request returns 503; no success is reported for a half-applied change.
