# Review write / AI read consistency contract — proposal v1

Status: **proposed for Fırat/Özgür review**, not accepted or deployed.
17 November 2026. Refs #56, #59, #67 and #68; FR-03/04/10, TC-16/26/28/35.

Source request: [Özgür's merge conditions](https://github.com/akcedia/SmartLoo/pull/67#issuecomment-6946984832).
Baseline inspected: #67 `8c5d58f1`, #68 `b66b6fb5`.
The already-approved principle is including `review_version` in the AI cache
key. The specific coordinator, persistence schema and methods below still need
agreement. This document does not alter Fırat's service, migration or public API.

## 1. Non-negotiable behavior

1. One facility's create/edit/delete, anonymization, closure, recovery, summary
   snapshot and final summary publication all honor the SAME shared guard.
2. Acquire that guard **before** any Mongo mutation. A SQL row lock acquired only
   during later recomputation cannot guard the preceding Mongo write.
3. Before touching Mongo, persist a pending operation marker. An in-memory lock
   or flag alone cannot prevent stale reads after a process/session failure.
4. Selected redacted text, actual total count/average, revision and read state
   come from one guarded logical snapshot. Never compute facility totals from
   the maximum-50 textual subset. Rating-only/anonymized public reviews count.
5. Do not hold the guard while calling OpenAI. After generation/validation, use
   a guarded publication operation which checks state/version and performs the
   bounded optional Redis write plus response assembly before releasing it.
6. `writing`, `busy` and `repair_required` never expose review text, call the
   provider, serve an old cached summary or write a new one. Return null summary
   and the last VERIFIED committed aggregate values. If those values cannot be
   read, propagate a store error for the route's 503; do not invent zero/current
   statistics. API wording must not imply unfinished Mongo changes are counted.

## 2. Proposed internal reader port

The existing `eligible_for_summary()` return shape is insufficient by itself:
it omits totals and a durable write/recovery state. Propose a dedicated
`snapshot_for_summary(toilet_id, limit=50)` operation on the review coordinator.
Consumer-side async protocol/types: `src/ai_review_contract.py`.

```json
{
  "protocol_version": 1,
  "toilet_id": "00000000-0000-4000-8000-000000000028",
  "state": "ready",
  "review_version": 4,
  "operation_id": null,
  "review_count": 100,
  "average_cleanliness": 3.5,
  "reviews": [
    {"id": "internal-review-id", "cleanliness_score": 4,
     "comment": "Temiz.", "created_at": "2026-11-17T09:00:00Z"}
  ]
}
```

`reviews` retains the #67 record fields, contains at most 50 eligible redacted
texts in newest-first/stable-ID order, and carries no user identity. Dates must
be timezone-aware. Provider preparation replaces internal IDs with request refs.
The example's 100 total ratings are intentionally different from one selected
text. Snapshot metadata uses nonnegative integer version/count and actual
1–5 average, or null only when count=0.

| state | operation_id | reviews | Meaning |
|---|---|---|---|
| ready | null | eligible texts | guarded read; totals/revision agree |
| writing | pending operation | empty | durable mutation is unfinished |
| repair_required | unresolved operation | empty | recovery must finish first |
| busy | optional pending operation | empty | bounded/nonblocking guard acquisition failed |

Missing facility remains 404. Unavailable metadata/read stores remain errors,
not empty successful reads. The internal metadata is not added to public HTTP.
`adapt_summary_snapshot()` validates this envelope and maps it to the existing
AI snapshot; parsing a `ready` label cannot prove the producer honored the guard.

## 3. Proposed writer/recovery sequence

Proposed concrete mechanism: a per-canonical-facility **session-level PostgreSQL
advisory lock**, plus a durable operation record/flag. This is one implementable
choice; an equivalent proven coordinator can replace it after review.

The application must make every participating path honor the lock. Session-level
locks span transaction boundaries and must be explicitly released or their
session closed; rollback does not release them. Dedicated session ownership,
bounded acquisition and safe pool cleanup are required. A timeout is not proof
that a writer completed. See [PostgreSQL 16 advisory-lock documentation](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS).

Write sequence under that lock:

1. Reject/recover an existing pending operation before accepting another write.
2. Commit a durable operation marker BEFORE changing Mongo. If marker commit
   fails, do not mutate Mongo. Marker carries an operation ID and safe recovery
   information; exact schema is Fırat's review/migration decision.
3. Apply the authorized Mongo change. Retain enough server-side protected
   recovery information to verify undo/reconciliation; never put raw PII in logs.
4. Recompute true totals from Mongo. In one PostgreSQL transaction store totals,
   increment `review_version` and clear the operation marker. Acknowledged
   success only follows commit. A retried operation must not increment twice.
5. On SQL failure, attempt undo while still holding the guard. Clear the marker
   only after undo and pre-operation state/totals are verified. No new revision
   is needed for a verified exact rollback whose intermediate text was unserved.
6. If undo fails, commit a repair state if possible. The earlier durable marker
   must remain even if this update fails too. Return 503, never success. Release
   the guard/close the session safely; do not make repair state disappear.

Recovery uses the same guard and an idempotent operation ID: inspect/reconcile
Mongo against the recovery policy, verify the resulting state, and atomically
store true aggregates, advance revision and clear the marker. Until that commit,
AI remains unavailable. Repeating an already completed recovery must not apply
the mutation or version bump again. A bare recompute with no pending-state
lifecycle is insufficient evidence of recovery.

For multi-facility account deletion, acquire guards in canonical UUID order or
process a durable per-facility worklist with AI blocked for affected facilities.
The chosen all-account recovery/acknowledgement policy needs separate review.
Do not call a Redis lock or a process-local Python lock distributed correctness.

## 4. Final publication port

```python
await coordinator.publish_summary_if_current(toilet_id, expected_version, publish)
```

Under the SAME guard, re-read state/version; reject busy/dirty/stale candidates
without invoking `publish`. Otherwise invoke it once for optional cache write
and final response assembly. `publish` must be short, cancellation-safe and
deadline-bounded; it must not call OpenAI or mutate reviews. Redis failure may
skip caching and still assemble a validated result, under the same guard.

Result statuses: `published`, `stale`, `busy`, `repair_required`, with verified
snapshot metadata and a candidate value only for `published`. A callback error
or cancellation must release the guard and never be mislabeled published.
Cache hits need the same ready/version-gated publication before returning text.

The linearization point is the final guarded acceptance/assembly. A writer may
start after the guard is released and before the HTTP bytes arrive; this is
normal concurrent behavior, not a promise to freeze data until network delivery.

## 5. Current implementation vs remaining integration

- Added strict snapshot envelope/parser, async port definition and adapter.
- Existing #68 generation uses a before/after revision check and has a gap
  between its check and cache write. **It does not yet call this guarded
  publication port.** Port wiring is step 2 after agreement, not claimed complete.
- No SQL/migration, upstream `src/reviews.py`, route, dependency or environment
  file changed. Fırat owns writer/recovery; Emir owns AI consumer/publication
  wiring; Özgür coordinates routes and merge; Yusuf verifies real DB evidence.

`tests/test_ai_consistency_contract.py` provides 15 synthetic executable examples:
actual totals vs selected text, dirty read rejection, edit/delete during AI,
failed SQL+undo, marker retained across coordinator recreation, verified recovery,
publication vs writer ordering, cancellation and exact rollback. Its test-only
coordinator uses one in-memory lock/state. It proves the proposed ordering model
and parser behavior, not process-crash durability, real PostgreSQL/Mongo locking,
upstream CRUD integration or TC-16 acceptance.

Required next real-service evidence: two workers/connections racing edit/delete
against summary read/publication; SQL failure + failed Mongo undo; worker/session
loss after durable marker; recovery retry; Redis outage; metadata outage and
deadline checks. Tests must exercise Fırat's actual writer and Emir's actual AI
consumer against real PostgreSQL/MongoDB, plus real Redis where relevant.

## 6. Decisions requested from Fırat / Özgür

- Accept these two dedicated internal operations and the complete snapshot?
- Accept the common session advisory guard + durable pending/recovery marker,
  or supply an equivalent that closes both the Mongo window and publication gap?
- Confirm marker storage, operation/recovery idempotency and last-verified-stat
  fallback policy; then assign the real joint tests and route wiring.

Acceptance requires an explicit review response; adding this proposal to #68 is
not team agreement and does not satisfy the merge conditions by itself.
