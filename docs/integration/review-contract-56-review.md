# #56 / #59 review integration — 17 November

Source: [Fırat's 17 November status](https://github.com/akcedia/SmartLoo/issues/56#issuecomment-6942043860),
also read in the Gmail notification `1a1e87b21afeafb9` (17 November 10:49 Istanbul).
Contract: [reviews-service.md at #50 head 2be3e821](https://github.com/akcedia/SmartLoo/blob/2be3e8215750e2a8fcb380308f205107b21e5e2f/docs/contracts/reviews-service.md).

## Verified current state

#50 and #51 now both target `main`. They remain **open and unmerged**. Fırat's
wording about merging current main into his branches means their bases were
updated, not that the PRs were merged into main. Current heads: #50
`2be3e8215750e2a8fcb380308f205107b21e5e2f`, #51
`4ebd1472d54ccadc199c8586f9cfaf973e81414f`.

The implemented reader in #50 returns scores/timestamps for analytics, not review
text. `eligible_reviews_for_summary(toilet_id, limit=50)` and `src/reviews.py`
remain planned. The reported real Mongo/PostgreSQL test counts are Fırat's
results; they were not independently rerun in this environment.

## Compatible decisions and local implementation

- PostgreSQL `review_version`, incremented with aggregates, is compatible with
  the AI service's versioned cache. Treat numeric `review_version` as the opaque
  internal revision string; retain policy/language identity and a six-hour TTL.
- Accept the proposed review fields `id`, `cleanliness_score`, `comment`,
  `created_at`. Already-redacted text still passes residual privacy approval.
  Provider payloads contain temporary refs and text, no permanent/user IDs.
- Added `ai_review_adapter.py` to map that exact payload shape into our service.
  Sorting is newest-first, stable ascending ID for ties. Duplicate IDs, invalid
  scores, unexpected identity fields and malformed dates/text are rejected.
- True total count/average are separate metadata. They are not computed from
  the limited set of summary comments. Zero total reviews requires null average.
- A `ReviewServiceRepository` bridge accepts an injected async consistent reader;
  it does not import the unimplemented `src.reviews` or use the analytics-only
  score reader as if it contained review text. Store failures propagate.

## Remaining contract decisions for Fırat / Özgür

1. **Fallback statistics:** The proposed eligible response contains a version
   and comments but not total count/average. Provide them in the same logical
   snapshot, or expose an explicitly coordinated read returning both. The local
   `ReviewStatistics` type describes our internal need, not a unilateral public
   API change. The bridge must normalize DB numeric types to validated int/float.
2. **Concurrent writes and compensation:** The new contract proposes Mongo write,
   SQL aggregate/version update, then undoing Mongo on SQL failure. Compensation
   improves the failure path, but does not by itself prevent an AI read between
   Mongo write and SQL commit/rollback. It also needs defined behavior if undo
   fails or a concurrent edit arrives before undo. Recalculated aggregates are
   idempotent; blindly retrying `version = version + 1` or undoing a document is
   not automatically the same property.
3. **Consistency boundary:** Agree writer/reader coordination (e.g. a shared
   per-facility lock, or a durable write-in-progress/epoch plus recovery policy)
   before the data adapter labels a read consistent. Equal before/after SQL
   versions alone cannot prove this during an unfinished Mongo mutation. The
   local metadata defaults to `consistent=False`; the AI path then returns a
   null summary and does not call the provider or read cached summaries. The
   associated statistics are the supplied snapshot values; production needs an
   explicit freshness/error policy for unfinished mutations too.
4. **Eligibility after redaction:** Return the newest 50 *eligible* texts after
   redaction/visibility checks, or provide a refill mechanism. If the downstream
   privacy check removes some of the 50, older valid comments should be available
   for filling the evidence window. Counts must still include rating-only
   comments where appropriate. Account deletion alone must not hide all ratings.

The local adapter tests cover these interface boundaries with synthetic reads;
they do not validate live Mongo/SQL coordination or approve migration 004.
No acceptance comment has been sent. Özgür remains merge/route coordinator;
Fırat owns the review service and migration. No shared file was changed here.

## 16–17 November deliverable status

| Work | Local status | External acceptance left |
|---|---|---|
| Review/revision contract and response examples | Prepared; now aligned to #50 proposal | Fırat/Özgür agreement on snapshot/compensation |
| Redis configuration handoff | Prepared against #66 local port settings | Yusuf confirms URL/client/timeouts; real Redis test |
| Independent provider/cache/revision tests | Executable, including real 10-second cancellation | HTTP/store/browser acceptance |
| Redaction and strict output validation | Implemented with required semantic policy gates | Production privacy/language/grounding policies |
| Preference-compatible maximum three facilities | Added `ai_recommendations.py`, deterministic ranking proposal | Team ranking review, live discovery/auth/route wiring |
| AI reason fallback | Candidate results survive provider/error/rejected reasons | Actual provider and grounded language policy |
| Small reviewable delivery | Local feature branch and verification evidence | No push/PR or daily #59 status comment sent |

Recommendation selection uses hard true/false amenity filters; unknown cannot
satisfy either. Discovery supplies real eligible facilities and geographic
distance; the route owns user auth/coordinate validation. Ranking is a proposed
lexicographic distance/cleanliness/verified-sentiment rule, not approved weights.
Optional provider reasons receive transient refs and factual fields only. Every
reason needs explicit language, one-sentence, privacy and grounding approval.
Failure preserves the candidates without reasons. No production AI policy is
inferred from deterministic test callbacks.
