# AI development and runtime traceability

Refs #59, #61, #82, #89. Codex assisted repository review, integration, implementation, test construction and evidence preparation under Özgür Kılıç's direction. [Working rules](../AGENTS.md) define authority and data boundaries. This is work beyond code completion, not a claim that every contribution was written by AI or independently human-reviewed.

## Development examples and verification

| Work | Trace and verification |
|---|---|
| Shared AI routes, cache/coordinator and recommendation composition | [AI release review](testing/AI-RELEASE-REVIEW-2026-11-24.md), contributor commits retained in #89. Synthetic/mounted tests and separately authorized native Gemini receipts have distinct scopes. |
| Broken acceptance fixtures and misleading invalid-output setup corrected | [Follow-up review](testing/FINAL-FOLLOWUP-REVIEW-2026-11-24.md). AsyncMock side effects had to be cleared before an invalid return value actually reached the validator. Existing failures are retained; green tests were not accepted as proof without checking their execution. |
| Generation constraints corrected | The original schema allowed global claim codes and unconstrained reasons. Two regression tests failed before constraining claims/sentences to candidate-specific verified evidence. The native diagnostic returned invalid-output fallback; its redacted receipt cannot prove which original output field failed. See the same release review and corrected-schema native receipt. |
| Security and integration quality | [Final quality review](testing/FINAL-QUALITY-REVIEW-2026-11-24.md), exact package inventories, coverage, original/final Sonar results and residual findings. |
| Performance diagnosis | Fresh/reused connection profiling and pool lifecycle/filter/rollback tests are recorded with final performance evidence. A passing functional test does not close the latency requirement. |

These are observed engineering defects or assessment mistakes caught during AI-assisted development; the synthetic human-review output-03 is a deliberately constructed example, not an observed native-model hallucination. It must not be presented as such.

## Runtime pipeline and boundaries

MongoDB reviews and PostgreSQL facility/revision state feed the coordinated evidence adapter. The restricted Turkish preparer removes unsafe/unrepresentable input. Provider prompts and structured generation use only permitted evidence/claims. Independent output validation rejects unsupported statements or personal data. Revision-aware Redis caching and guarded publication prevent stale summaries from becoming current after edits/deletions. See [adapter design](design/adapter-ai-contract.md), [consistency contract](contracts/ai-review-consistency.md) and [guarded publication](integration/ai-guarded-publication.md).

AI failures, quota/timeout or insufficient eligible comments preserve core search and explicit fallback. Unknown İBB fee/accessibility/schedule facts remain unknown. No model key belongs in Git, frontend code, PDF or the ZIP. Native calls require a bounded approved budget and no automatic retry.

The new [partial human review](testing/evidence/ai/human-review-ozgur-2026-11-24.md) records grouped decisions without manufacturing unreviewed labels. It is not completed independent language/privacy acceptance. Native-provider smokes, synthetic tests and human judgments must remain separate.

On 24 November Özgür explicitly declined further Gemini requests for the final check and selected the existing evidence. Retain the four previously authorized native requests with their original source revisions. Do not run new native calls or relabel those historical receipts as new final-source tests.
