# AI release candidate review — 24 November 2026

Local candidate `75dcca4`: #96 `8db1e7b` (including #89 `1c12678`)
integrated with main `7b82413`. No push, merge or cloud activation has been
performed in this review. Emir retains ownership of the policy/provider work;
Özgür reconciled the shared routes/runner and mobile-panel styling.

## Integration

- Preserve AI, suggestions, facility status and ADMIN import routers together;
  keep the auth/Sonar correction and all mounted runner modes.
- Keep the selected map radius connection and the moderation delayed-response
  guards. Use a stable AI-panel CSS class so its mobile positioning also applies
  to the non-AI fallback, whose accessible name differs from the AI result.
- Preserve v3's exact full-field paraphrase and grounding/PII guards, previous
  profile selectors and version-separated cache identity. Unknown source facts
  remain unknown; no general Turkish/privacy acceptance is claimed.
- Prepare CI to require 42 Turkish checks and eight fake-HTTP guards covering
  both the original two-request pilot and a separately approved one-request
  recommendation diagnostic. Neither CI command uses a real API key.

## Local verification and retained first-run failure

- Before the small stable-class adjustment: **290 frontend tests passed**, build
  passed. Afterward the 12 relevant map/recommendation tests and build passed.
- Initial private-store run: **184 passed / 1 failed / 0 skipped**, 25 subtests.
  The local runner explicitly set the provider selector to an invalid empty
  string; the opt-in startup check correctly rejected it. No application test or
  production validation was weakened. The first receipt is retained.
- With the runner using a supported selector and all real model credentials
  removed: **185 passed, zero failures/errors/skips, 25 subtests passed**.
  Required JUnit guard passed. Real local PostgreSQL/PostGIS, MongoDB and scoped
  Redis were used with synthetic providers/fake HTTP; zero model calls.
- Mounted suites on the same application composition passed separately: AI 4,
  moderation 1, import 1, map/reviews 9; zero failures/errors/skips. They were
  not needlessly repeated after the backend-runner selector correction.
- The final private SQL DB held the 13 seed facilities, zero users, suggestions
  and recovery operations before being dropped. The root test Mongo namespace
  was removed; fixture-specific namespaces retain their existing test cleanup.
  Public stores and personal accounts were not used.
- Four additional follow-up diagnostic guards passed using fake HTTP only:
  success, transport timeout, quota response, and refusal without separate
  approval. This is not an additional native-provider run.

## Native Gemini pilot — partial acceptance only

The original bounded tool ran once on clean commit `75dcca4`, using the existing
private Free-tier configuration. Model `gemini-3.1-flash-lite`, policy v3, exactly
two attempted provider requests, only fixed synthetic data:

| Route | HTTP | Time | Grounding/contract outcome |
|---|---|---|---|
| Summary | 200 | 3140 ms | Validated, three synthetic reviews |
| Recommendation | 200 | 8022 ms | Fallback true, AI reason not validated |

The recommendation duration is near the configured eight-second provider
budget, but this original receipt does not identify its internal error code.
Do not diagnose a specific transport/provider error from elapsed time alone.
No automatic retry was made; the original receipt was not overwritten. This is
one successful synthetic summary smoke, not successful native recommendation
acceptance, a reliability/latency percentile result or a full real-store native
model end-to-end test.

A separately approved single-request diagnostic ran on clean commit `6122e28`.
Gemini returned HTTP 200; the application returned its explicit fallback in
4936 ms with `gemini_invalid_output`, while preserving the one eligible
synthetic facility. This was not a 429 quota response. The receipt does not
include raw text and cannot identify which field of the original model output
was invalid. No credentials or arbitrary exception text were recorded. Total
native requests authorized and attempted through this first follow-up: **three** (two initial,
one separately approved follow-up); no automatic retry occurred.

## Grounded generation-schema correction after the follow-up

Offline inspection found that the request schema offered all global claim codes
and an unconstrained reason string, even for candidates with only a small set
of verified facts. The strict parser correctly rejected unsupported output, but
the generation schema did not express the same constraints. This is a confirmed
schema gap, not proof of the exact original native-output defect.

Two new tests failed before correction. The generation schema now offers only
claim codes present in the supplied evidence and a finite set of already
accepted grounded sentences. Sentence combinations are built per candidate,
never by combining different candidates' facts. The existing parser still
independently checks each candidate/ref/claim/sentence association and the
all-or-nothing fallback remains. No validator or language/privacy guard was
relaxed and no synthetic reason is substituted for a failed model result.

After correction, **87 focused tests and 8 subtests passed**, covering reason
generation/validation, Gemini adapter, both pilot harnesses and Turkish policy.
The two genuinely failing pre-change tests are retained in JUnit; no separate
historical red commit is claimed. CI's recommendation-component minimum is now
16. **No additional native request has been made on this corrected schema.**
Native recommendation acceptance remains open.

The diagnostic now reserves a receipt named with the reviewed commit SHA,
preserving the earlier fixed-name receipt and refusing another request on an
already completed revision. A changed revision still requires separate explicit
approval; this naming change does not authorize another request. Five focused
diagnostic guards passed, including receipt preservation/repeat prevention.
CI requires nine original-pilot/follow-up harness cases in total. At that point,
another native request still required separate approval.

## Separately approved corrected-schema native result

One request on clean commit `d89a083` succeeded: provider HTTP 200, application
HTTP 200, **1445 ms**, one eligible candidate preserved, `fallback=false`, and
the reason passed the grounding/response contract. See
[corrected-schema receipt](evidence/ai-release-2026-11-24/native-recommendation-corrected.json).
No automatic retry was made. The complete authorized native-call history for
this review is now **four**: two initial requests, one diagnostic follow-up and
one separately approved corrected-schema request. Earlier failed receipts remain.

The earlier summary smoke and this recommendation smoke passed on their
respective recorded commits. This is not a percentile/reliability measurement,
independent human acceptance, physical browser acceptance or a combined native
model + real SQL/Mongo/Redis release run. The current schema has one successful
synthetic native recommendation sample; broader acceptance remains open.

## Requirements catalog and remaining gates

Unchanged catalog on this candidate: **47 passed / 5 failed / 0 skipped**.
Failures are TC-08, TC-16, TC-17, TC-21 and TC-28. The legacy catalog supplies a
synchronous mock without selecting the opt-in AI profile; its model call-count
and reason expectations need review against the current composed fixture.
These observed failures remain failures; focused integration successes do not
silently replace them. TC-21 targets the API factory's home placeholder, not the
separate cloud frontend factory. Yusuf should retain the source/environment and
distinguish fixture corrections from changed requirements or missing behavior.

Independent human labels/paraphrase review, native recommendation acceptance,
remaining AI/user-screen TR/EN and final browser/mobile acceptance remain open.
The separate logo preparation is not included. Migration 008/cloud AI settings,
final quality/performance/report work, #82 ticks and Learn submission remain
separate authorized steps.

Machine-readable evidence: [review directory](evidence/ai-release-2026-11-24/).
