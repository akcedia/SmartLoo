# #59: first implementation slice and integration proposal

17 November 2026. Branch: `feature/59-ai-service-contract`.
Base: main `24611ddee81f4c93c8e6ce2b365a0dc96fb9debb`.
Refs [#59](https://github.com/akcedia/SmartLoo/issues/59), FR-04, WBS 5.3.

Additional reference: user-provided **SmartLoo Software Design Report**, revision
0.4, 14 November 2026, 28 pages; SHA-256
`90a4f623f44eb3ae8ef675eba315fd496bc6719978d58d5cc4ed4d423e2634b0`.
Pages 1–2 distinguish proposed AI contracts from implemented search. Page 4 and
Figure 17 (p.23) define the AI flow; Figure 19 (p.25) covers recommendations.
Pages 5–6 retain NFR measurements and cross-store concurrency as pending work.
The report is a reference, not evidence of new implementation or team approval.

## Implemented locally

`src/ai_summary_service.py` orchestrates async repository, cache, provider,
evidence preparation and output validation ports. There is no permissive default
sanitizer or validator. Wiring these ports is mandatory before production use.
It caps prepared evidence at 50, skips generation below 3, adds server-owned
count/time, uses a six-hour revision/policy cache, and rechecks the source
revision after provider/cache operations. A consistent source snapshot is
required even for cache hits. Old revision keys expire naturally.

The total async pipeline has a 10-second cancellation budget. Every production
port must be nonblocking and cooperate with cancellation; client-level socket
timeouts must also be bounded. This is not proof of the full HTTP latency SLA.
Cache errors allow generation with verified source data. Provider/validation
errors return null summary and last-read real statistics. An initial repository
failure is propagated for the route owner to map to 404/503; statistics are never
invented. Logs contain correlation IDs and error types, not exception messages.

`RedisSummaryCache` accepts an injected `redis.asyncio`-compatible client and
uses JSON and `SET ... EX 21600`. The client/package is not yet installed or
connected. The test double proves the call contract only.

## Redis settings to confirm with Yusuf

[Yusuf's request](https://github.com/akcedia/SmartLoo/issues/60#issuecomment-6926607345)
refers to [draft PR #66](https://github.com/akcedia/SmartLoo/pull/66), head
`53b064d48ed4ddbc5d2c144443c1a12390efa9fa`, not merged main.

| Runner | Redis address from #66 |
|---|---|
| App on host, default port | `redis://127.0.0.1:6379/0` |
| App on host, custom published port | `redis://127.0.0.1:<SMARTLOO_REDIS_PORT>/0` |
| Future app container on same Compose network | `redis://redis:6379/0` |

#66 defines `SMARTLOO_REDIS_PORT=6379` for Compose port publication. It does not
define an application Redis URL variable. These host/container URLs are derived
connection proposals. No `REDIS_URL` name has been agreed or added here. The app
must explicitly consume the confirmed URL; changing the published port alone
does not configure the app client. Confirm DB index/namespace, async client
dependency/version, socket deadlines and ownership with Yusuf before editing
shared environment/dependency/CI files. Local Redis in #66 has no password;
this does not define production credentials or TLS policy.

## Repository contract to confirm with Fırat and Özgür

`ReviewRepository.snapshot(toilet_id)` must return one logical consistent view:
revision, visible reviews ordered newest first with stable ID ties, actual
review count and mean. Evidence preparation must redact identifiers, discard
unsafe/empty text, preserve ordering and supply only transient refs and text.
Rating-only reviews still count in statistics. `consistent=False` is required
while a known cross-store update is unfinished.

[Fırat's proposal](https://github.com/akcedia/SmartLoo/issues/28#issuecomment-6400782736)
places `review_version bigint` beside aggregates in PostgreSQL, incremented
in the same SQL transaction after Mongo changes. That comment explicitly leaves
Mongo-success/SQL-failure recovery open. It is a proposal, not evidence of an
approved/applied migration. A version check alone cannot detect a Mongo write
whose SQL revision has not advanced. Agree an outbox/pending-write or equivalent
consistency mechanism before claiming stale-summary prevention in real stores.
Concurrent reads linearize at the final source revision check; mutations after
that point may naturally occur. No cross-store atomicity is claimed here.

## Output and HTTP handoff

`ai_evidence.py` now adapts typed review text, sorts newest-first with stable ID
ties, drops deleted/invisible/rating-only records, strips known author identifiers
and common email/phone/ID/URL/token/coordinate patterns, and emits only temporary
refs plus text. It still requires explicit approval from a privacy policy: regex
cannot reliably detect arbitrary names or addresses. Uncertain text is excluded.
Author identifiers must be supplied by the real repository adapter.

`ai_output.py` implements strict schema, a 400 Unicode code-point limit,
pros/cons (0–3 each, at most 100 code points per phrase), recommendation enums
and the proposed five categories. Unknown fields, duplicate JSON keys and
nonfinite JSON constants are rejected. It also requires explicit privacy,
Turkish-language and grounding checks. Those semantic policies remain injected
test policies rather than production implementations. Categories and
semantic-validation policy still need team review. OpenAI must keep system instructions separate
from review data, use structured output, have no tools and no secret in payloads.

Özgür owns route registration. Preserve `GET /api/v1/toilets/{id}/summary`.
Proposed success envelope: validated summary/pros/cons/recommendation/categories
plus server-added `based_on_reviews` and UTC `generated_at`.
Fallback example with synthetic statistics:

```json
{"summary": null, "message": "Summary temporarily unavailable.", "average_cleanliness": 4.0, "review_count": 3}
```

Below 3 eligible reviews, message is exactly
`Not enough reviews to generate a summary (minimum 3).`.
HTTP 200 mapping is a route integration task; this slice does not register routes.

## Verification and remaining work

Run `python3 -m unittest discover -s tests -p 'test_ai_*.py' -v`.
72 tests passed, 0 failed, 0 skipped on macOS / Python 3.14.3 (10.081 seconds).
Includes an actual 10-second cancellation test and a separate immediately raised
TimeoutError test; TTL uses a fake clock. New tests cover redaction, post-privacy
eligibility, strict output schema and rejected-policy fallback. Test callbacks
do not demonstrate general language/PII/semantic detection.

Run `python3 -m examples.ai_summary_demo` for an offline demonstration. Two
reads use one synthetic provider call; deleting a review changes revision and
returns a null summary at two reviews without another provider call. The
privacy/language/grounding allowlists in this example apply only to the audited
synthetic fixture strings and must never be used for arbitrary real comments.

| Acceptance | Evidence in this slice | Still required |
|---|---|---|
| TC-08 | evidence cap, strict schema, 400/401 boundary | production language/grounding; HTTP; live-provider smoke |
| TC-15 | insufficient input, provider failure, actual async timeout | HTTP 200, independent nearby regression and browser |
| TC-16 | hit, expiry, revision changes, races, cache failure | real Redis, real Mongo/SQL mutation consistency |
| TC-17 | hard filters, max 3, ranking proposal and rejected/error reason fallback | live discovery/auth/HTTP and production grounded-reason policy |
| TC-28 | known/pattern PII redaction, policy-rejection fallback and safe logs | production residual-PII policy, separated provider instructions and grounding |

Related M scenarios are partial service-level evidence; no TC is declared passed.
No full existing pytest suite ran: this execution environment lacks its packages.
No Docker or redis-server executable was found. User confirmed Docker/Redis and
OpenAI access are not yet available; continue offline. No live OpenAI key was
checked or used. No HTTP/UI acceptance, real Redis/Mongo integration, GeoJSON adapter,
live recommendation integration, external import or independent review is complete.

Next: confirm ports/settings and production privacy/language/grounding policies,
wire the implemented OpenAI adapter and real repository/cache/routes, then execute TC-08/15/16/17/28
with Yusuf and Furkan. GeoJSON normalization is Thursday's separate slice;
source identity/alias decisions remain shared with Fırat. Shared route, migration,
Compose and dependency files have not been changed. No GitHub write, message,
push, PR, merge or issue closure was performed by this local work.

## Follow-up after Fırat’s 17 November mention

Read #56 comment 6942043860 and the full Gmail notification. #50/#51 now target
main but are still unmerged. Read the new review-service contract at pinned #50
head 2be3e821. The proposed eligible reader is not yet implemented; the existing
score reader cannot supply AI text. Local adapter and recommendation modules
were added; see [detailed review](review-contract-56-review.md) for the compatible
interface, required metadata and remaining concurrent-write/rollback decisions.
The 55-test run includes 11 adapter and 9 recommendation tests beyond the earlier
35. Demo still passes. No shared route, migration or environment file changed;
no external message, approval, push or PR was sent.

## OpenAI adapter follow-up

`src/ai_openai.py` now implements the server-side provider; setup, official API
sources and limitations are in [ai-openai-setup.md](ai-openai-setup.md). 16 new
transport/payload/error tests plus the #67 ISO timestamp compatibility case
bring the local suite to 72 tests. This supersedes the older note that the
adapter was still unimplemented; live OpenAI access/smoke remains pending.

Fırat's unmerged #67 now implements the eligible reader. The latest code review,
including timestamp shapes, redaction limits, incomplete cross-store read
coordination and missing total statistics, is at the top of
[review-contract-56-review.md](review-contract-56-review.md). No approval or
external coordination comment was sent on the user's behalf.
