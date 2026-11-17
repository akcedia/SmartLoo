# #59 initial offline implementation — verification

17 November 2026; macOS, Python 3.14.3. Base main: `24611dde`.

```sh
python3 -m unittest discover -s tests -p 'test_ai_*.py' -v
python3 -m examples.ai_summary_demo
```

Latest recorded test run: **87 passed, 0 failed, 0 skipped**, 10.305 seconds.
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

This is service-level synthetic evidence, not full TC-08/15/16/17/28 acceptance.
TTL uses a fake clock; an immediately raised TimeoutError is tested separately
from the actual 10-second timer. Redis adapter calls are tested with an injected
client double. Language, residual privacy, grounding and one-sentence policies
are explicit injected test policies; general production policies remain pending.

No live OpenAI, Redis, MongoDB/PostgreSQL coordination or HTTP/browser test ran.
The existing full pytest acceptance catalog did not run in this environment.
No shared route registration, migration, Compose, CI or dependency file changed.
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
The current SummaryService is NOT yet wired to the proposed guarded publication
port; its separate revision checks do not close the cache-write race. No joint
TC-16/26/35 acceptance is claimed.
