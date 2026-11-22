# Optional restricted Turkish evidence profile

`src/ai_restricted_policy.py` supplies concrete input, output-language/privacy,
and grounding checks for a **finite grammar**, version
`restricted-tr-evidence-v1`. This is an opt-in experimental profile, not the
approved production policy or full TC-08/TC-28 acceptance.

## Behavior

- Accept complete enumerated clauses such as `Temizdi.`, `Temiz değildi.`,
  `Sabun yoktu.`; the source `CLAUSES` is the exhaustive vocabulary. Unknown
  wording is excluded before a provider call. Fewer than three eligible reviews
  produces the existing null-summary fallback with repository statistics.
- Normalize Turkish case and NFC; reject controls, questions, extra clauses,
  names, instructions and redaction markers unless the entire text matches the
  grammar. This is not general Turkish understanding or general PII detection.
  In particular, do not remove redaction markers and infer meaning: replacing
  an author identifier that equals a negation could change the claim.
- Preserve positive/negative conflicts even when most reviews agree. Track
  soap, paper and water separately; an aggregate supplies state may be mixed
  without conflicting statements about the same item. Missing evidence stays
  unknown. Lighting observations are reported as observations, never as a
  safety inspection; the existing `safety` category is only a lighting proxy
  in this profile and must not update facility features or hard filters.
- Require the canonical supported summary, category states and recommendation;
  allow up to three distinct supported pros and cons. Reject inventions,
  polarity flips, hidden conflicts, unsupported positive categories and extra
  personal information. All seven conflicting facets fit the 400-character
  summary budget. `expected_candidate` is a fixture/demo helper, not a model.
- The recommendation rule is a review proposal: negative cleanliness/odor
  means avoid; positive cleanliness with no negative/mixed facet means
  recommended; otherwise acceptable. Team acceptance remains required before
  production selection.

## Explicit composition

Pass `restricted_preparer()` and `restricted_validator()` into `SummaryService`
alongside the required real repository, cache, provider and guarded publication
callback. Set `policy_version` to an identity that includes this profile version,
the actual model/prompt version and any changed schema/redaction rules. Do not
reuse the cache identity of another policy. No route or production composition
is changed by adding this module.

The existing OpenAI prompt is free-form. This exact-output profile can reject
valid paraphrases and reduce summary availability; it has not been calibrated
with a live model or evaluated on representative human-labeled Turkish reviews.
Do not silently enable it for production or claim broad semantic validation.
Prompt alignment, human review, coverage measurements and agreement on the
recommendation/safety interpretation remain open.

## Validation

`python3 -m unittest tests.test_ai_restricted_policy -v` runs 16 synthetic tests,
including actual preparer/validator/service composition and the test-only
shared-lock coordinator. Provider responses and repositories are synthetic;
these tests do not establish live OpenAI quality or PostgreSQL/MongoDB atomicity.
The full AI suite now contains 117 tests. Real Redis evidence is documented
separately in [ai-real-redis.md](ai-real-redis.md).
