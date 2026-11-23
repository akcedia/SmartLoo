# Turkish summary policy v3 review proposal

Candidate base: #89 at `1c126786`. Refs #59 and #82. The earlier restricted v2 measurement accepted 9/12 usable-labelled inputs. This follow-up proposes a single output decision change and retains the existing input decisions.

| Case | Proposed decision | Grounding |
|---|---|---|
| `input-09` | Keep excluded in the restricted profile | “Pek temiz sayılmazdı.” signals a mild negative observation. Rendering it as “Kirli.” would strengthen the observation. An explicit graded cleanliness representation needs separate review. |
| `input-10` | Keep excluded | “Ağır bir koku” describes intensity. It does not specify whether the smell was unpleasant, which is the current negative odor output. |
| `input-12` | Keep excluded as a complete review | “Su akmıyordu” reports unavailable running water, while “kâğıt vardı” does not identify the paper as toilet paper. The restricted preparer requires every clause to map to supported evidence. |
| `output-02` | Accept one exact equivalent when grounded | “Temizdi fakat sabun yoktu.” expresses the same two facts as “Temiz, ancak sabun eksik.” The entire field maps to that canonical summary. Missing soap evidence, a contradictory soap report, and appended personal data still fail. |

The model prompt continues requesting the canonical wording. Summary policy identity is bumped to v3 to isolate previous cache entries. Existing profile selectors continue to opt in. Other output fields still follow their original evidence checks. The earlier policy and measurement are preserved in the base commit and the historical evidence files.

This is a technical proposal using synthetic cases. Yusuf's independent labels remain pending and the existing form was left untouched.

## Verification

- The first run of the updated corpus failed on `output-02` before the change.
- macOS / Python 3.14: 119 focused tests passed, including 25 passing subtests. Two real-PostGIS fixture tests were deselected. The offline corpus matched 38/38 policy expectations, with the input result unchanged at 9/12 usable and 8/8 excluded. Zero live model calls.
- Separately, the running local #89 API returned HTTP 200 against the local synthetic facilities at radii of 1000 m and 5000 m, with two and three results respectively. Both returned `fallback=true`, `ai_reasons_available=false` and no reason fields. This was an HTTP observation on the base candidate, separate from v3 and from browser rendering checks.

## Native Gemini acceptance still to run

Coordinate the free-tier key and call window with Özgür. An isolated candidate should make at most two planned calls, one three-comment synthetic summary and one recommendation with a synthetic facility whose fee and accessibility are verified. Use the existing opt-in Gemini runtime with no paid fallback or automatic retry. Record commit, model, latency, HTTP flags, grounding outcome and whether fallback occurred. Do not record credentials or raw provider responses. A single success per flow is a smoke check. Browser fallback and synthetic-provider tests have their own evidence.

After Free-tier access is confirmed, provision the local key with the existing `scripts/configure_gemini.py` if needed. From the candidate checkout and the test virtual environment, run:

```bash
python scripts/check_gemini_http_acceptance.py --confirm-free-tier
```

The pilot calls the two public API routes in process with fixed synthetic fixtures. PostgreSQL, MongoDB and Redis are not needed for this smoke check. The ignored `.venv/gemini-http-acceptance.json` receipt is reserved before either call, and an existing receipt blocks a rerun. Share the redacted receipt rather than the private settings. The tool succeeds only if both public responses pass grounding.

Offline tool verification: `python -m pytest tests/test_gemini_http_acceptance.py -q` passed four cases. The transport was mocked. No native Gemini call occurred.
