# Review data and revision contract (FR-03, FR-04, FR-06, FR-10)

Owner: Fırat Karadoğan ([#56](https://github.com/akcedia/SmartLoo/issues/56)). For Özgür (route registration, details, analytics) and Emir (AI summary). Data rules come from the [class model](../design/class/accounts-and-data.md) and [er-data-dictionary.md](../analysis/data/er-data-dictionary.md).

**Status.** `read_review_scores()` is implemented and tested on MongoDB ([#50](https://github.com/akcedia/SmartLoo/pull/50)). Everything under "Planned" is the interface I will implement this week; names are proposals until Özgür and Emir confirm them in #56.

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

## Planned: review service (`src/reviews.py`)

Pure functions with injected stores; Özgür registers the routes in `src/app.py` and does not reimplement them.

| Function | Route | Results |
| --- | --- | --- |
| `list_reviews(toilet_id, limit=20, offset=0)` | `GET /toilets/{id}/reviews` | 200 `{count, results}`; author shown as display name or `"Anonymous"`; 404 unknown toilet |
| `create_review(principal, toilet_id, cleanliness_score, comment=None, tags=[])` | `POST /toilets/{id}/reviews` | 201 review; 401 guest; 404 toilet missing or `CLOSED`; 409 second review by the same user; 422 score outside 1–5, comment over 1000 characters, unknown tag |
| `update_review(principal, review_id, changes)` | `PATCH /reviews/{id}` | 200; 403 not the author; 404; 422 |
| `delete_review(principal, review_id)` | `DELETE /reviews/{id}` | 204; 403 neither author nor ADMIN; 404 |
| `eligible_reviews_for_summary(toilet_id, limit=50)` | used by Emir | `{review_version, reviews: [{id, cleanliness_score, comment, created_at}]}`, newest first, comments already redacted, no user ids |

Every successful change returns only after PostgreSQL has the new average, count and `review_version` (REQ-DB-05, TC-26, TC-35).

**Consistency approach.** MongoDB is written first, then the PostgreSQL aggregates are **recomputed from MongoDB** for that toilet (not incremented), together with the version bump. Recomputing is idempotent, so a retry after any partial failure gives the same result. If the PostgreSQL step fails, the MongoDB change is undone (restore the previous document or delete the new one) and the request returns 503; no success is reported for a half-applied change.
