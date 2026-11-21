# #59 step 2 — consumer-side guarded publication

Status: consumer wiring implemented against the **proposed** consistency port.
Fırat/Özgür have not accepted or implemented its production backend. Their
`src/reviews.py`, migrations and shared route/environment files were not changed.

## Changes

`SummaryService` now requires an explicit callable `publish_current`. There is
no unguarded default/fallback path. Both newly generated results and cache hits
pass through this callback. Only its accepted decision can expose summary text.
It must execute response assembly and bounded cache write under the SAME guard
as review writers; model generation/semantic validation happen outside it.

```python
from src.ai_review_adapter import CoordinatedReviewRepository
from src.ai_summary_service import SummaryService

repository = CoordinatedReviewRepository(review_coordinator)
service = SummaryService(
    repository, cache, provider,
    prepare_evidence=reviewed_evidence_preparer,
    validate_output=reviewed_output_validator,
    policy_version=approved_policy_version,
    publish_current=repository.publish_current,
)
```

`review_coordinator` must implement both operations in
`docs/contracts/ai-review-consistency.md` / `ConsistentReviewPort`. It is not the
old uncoordinated `eligible_for_summary()` call. The async adapter converts its
complete snapshot and rejects invalid facility/version/state/result combinations.
Separate Mongo/SQL reads cannot be silently substituted.

Publication flow:
1. Read a complete snapshot; dirty/busy state returns null summary without cache
   read or provider call, using supplied last-verified committed statistics.
2. Prepare evidence, resolve optional cache and/or call/validate the provider.
3. Invoke `publish_summary_if_current` through the adapter. Under the common
   guard, the coordinator checks current ready/version and invokes the consumer
   callback once. Only that callback can write the successful summary to Redis.
4. Rejected decisions use the decision's verified snapshot statistics and expose
   no old/generated summary. Accepted decisions must match the expected version
   and callback result; fabricated success without callback is rejected.

The cache-hit path also checks under the guard, but does not rewrite the cache.
Redis failure can skip caching and still return validated text after guarded
acceptance. The encompassing ten-second budget covers guarded publication too;
the real client/coordinator must cooperate with cancellation and release locks.

## Verification

The full local AI suite has 101 tests (0 failed, 0 skipped). Fourteen new tests
run the actual SummaryService and CoordinatedReviewRepository against a shared
in-memory writer/coordinator model. They cover successful guarded cache write,
cache hit, concurrent edit/delete, busy/repair states, latest aggregate fallback,
writer waiting while the cache callback holds the guard, missing/fabricated
publication, Redis failure, cancellation and a short actual deadline.

The original real ten-second cancellation test remains in the full suite. Older
isolated tests use `tests/ai_test_ports.py`'s explicitly sequential fixture;
that helper is not a distributed coordination implementation. The demo mutates
only between requests and is not concurrency evidence.

These tests establish consumer behavior with a conforming test port, **not**
real PostgreSQL/MongoDB/Redis consistency, durable repair, worker crash safety or
joint TC-16 acceptance. Existing writers that mutate Mongo before taking a
common guard still do not satisfy the producer side. No runtime production
coordinator, route wiring or live OpenAI test is claimed.

## Next real integration work

Fırat/Özgür need to review the shared guard and durable pending/repair protocol,
supply its two real operations and agree on committed-stat fallback semantics.
Then the actual writer and this consumer must run together against real stores,
including edit/delete races, SQL failure plus undo failure, restart recovery,
Redis outage and deadlines. Yusuf should make that suite a blocking CI gate.
The PR remains draft and the related issues remain open.
