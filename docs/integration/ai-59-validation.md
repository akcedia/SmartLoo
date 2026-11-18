# #59 initial offline implementation — verification

17 November 2026; macOS, Python 3.14.3. Base main: `24611dde`.

```sh
python3 -m unittest discover -s tests -p 'test_ai_*.py' -v
python3 -m examples.ai_summary_demo
```

Latest recorded test run: **101 passed, 0 failed, 0 skipped**, 10.153 seconds.
Python syntax checks passed. The offline demo also passed: two reads produced
one synthetic provider call; deletion reduced eligible reviews to two, resulting
in a null summary without reusing old cached text or making another call.

| Suite | Tests | Scope |
|---|---:|---|
| test_ai_summary_service.py | 17 | Orchestration, hit/TTL, revision races, errors, actual 10-second cancellation |
| test_ai_boundaries.py | 18 | Redaction, privacy eligibility, strict schema, injected policy rejection |
| test_ai_review_adapter.py | 12 | Proposed #50 record shape, statistics and consistency boundary |
| test_ai_recommendations.py | 9 | Hard filters, maximum three, ranking proposal, optional reason fallback |
| test_ai_openai.py | 16 | Request/schema construction, isolated review data, safe errors, refusal/truncation, async timeout and service wiring |
| test_ai_consistency_contract.py | 15 | Proposed complete snapshot parser and test-only interleaving/recovery/publication model |
| test_ai_guarded_publication.py | 14 | Actual consumer/adapter with shared-lock model: publication, races, repair, cancellation and cache failure |

This is service-level synthetic evidence, not full TC-08/15/16/17/28 acceptance.
TTL uses a fake clock; an immediately raised TimeoutError is tested separately
from the actual 10-second timer. Redis adapter calls are tested with an injected
client double. Language, residual privacy, grounding and one-sentence policies
are explicit injected test policies; general production policies remain pending.

No live OpenAI, real MongoDB/PostgreSQL coordination or HTTP/browser test ran.
Real Redis component verification now passed separately; see below.
The existing full pytest acceptance catalog did not run in this environment.
No shared route, migration, Compose, existing ci.yml or shared dependency file
changed. A new isolated AI Redis workflow is proposed separately.
See ai-59-handoff.md and review-contract-56-review.md for remaining integration
decisions and ownership. This first delivery must remain a draft; it does not
close #59, #28 or #39.

OpenAI adapter follow-up: src/ai_openai.py and ai-openai-setup.md now provide a
server-side implementation and setup contract. Network behavior is tested with
an injected fake HTTP transport, not a live API request. Shared CI discovers the
AI unittest classes through its full pytest baseline, but that baseline is
non-blocking. A dedicated blocking AI test job remains Yusuf's coordination item.

Consistency-contract follow-up: docs/contracts/ai-review-consistency.md is a
concrete review proposal, not accepted coordination or a deployed lock backend.
The 15 new tests use an in-memory model, not Fırat's actual writer or real DBs.
Step 2 now wires SummaryService through a mandatory guarded publication callback
for new results and cache hits. Tests exercise the actual consumer and adapter
with a conforming in-memory coordinator. The production writer/coordinator and
real stores remain pending; no joint TC-16/26/35 acceptance is claimed.

18 November real Redis evidence: eight checks passed with zero failures/errors/
skips on Redis 7.4.12, redis-py 8.1.0 and Python 3.11.18. The same dedicated job
passed the 101 AI unit tests. See ai-real-redis.md and source-linked report
../evidence/ai-redis-2026-11-18.json. This verifies the Redis adapter/component,
not real multi-store coordination or live OpenAI. The new job is not silently
skipped and missing setup fails; branch-protection requirements need team review.
