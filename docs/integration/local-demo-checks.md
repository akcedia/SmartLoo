# Local demo: session setup and unknown source filters

21 November 2026. Separate fix based on main after #63; does not include draft #68.

## Sign-in failure

The existing 5182 demo called the 8012 API without a JWT signing key. Registration
does not issue a token, so it succeeded; login correctly returned HTTP 503,
`Authentication is not configured`. This was a runtime configuration failure,
not evidence that registered accounts had disappeared.

For local development, `python scripts/run_local_api.py` starts the API on
127.0.0.1:8000 with the normal environment settings. It uses an explicitly set
SMARTLOO_JWT_SECRET or generates a persistent random local key at
`.venv/local-jwt-secret` (ignored by Git). It never prints the key. Invalid short
keys are rejected; restarting preserves the local signing identity. This helper
is for local development, not production secret provisioning.

The existing demo uses SQL port 5437, Mongo port 27019 and API port 8012:

```powershell
python scripts/run_local_api.py --port 8012 --db-port 5437 --mongo-url mongodb://127.0.0.1:27019
```

Apply the existing migrations first; the launcher does not reset databases.
The current demo was moved to this main-based checkout with migration 007 applied;
432 imported records and pre-existing accounts were retained. The frontend stays
at http://127.0.0.1:5182 and proxies to 8012.

## Filter coverage

All 432 current imported İBB records have NULL for has_disabled_access,
has_baby_changing and is_free. A requested true/false filter must exclude unknown
values; returning zero matches was correct, but the UI did not make the reason
clear enough.

The directory response adds `filter_coverage`: total source records and counts
with known values for each field. Counts include both true and false, are taken
before filtering, and share a REPEATABLE READ snapshot with the returned rows.
Existing source/results/count fields remain. The store helper's default still
returns the original list; the directory explicitly requests coverage.

In citywide mode, a field with zero known values is marked “bilgi yok” and its
inactive filter is disabled, so clicking cannot remove every marker. The UI
shows known/total counts. Controls remain available when verified information
exists, and active filters can still be cleared. Unknown values remain NULL;
no accessibility, baby-care or pricing facts are fabricated.

Nearby search keeps its existing filtering semantics. Improving source coverage
requires a verified supplementary source or curated facility information, not
guessing from fixture values or toilet type. Historical usage statistics do not
establish these amenities or prices.

## Verification

- Temporary migrated-database tests cover zero coverage, known true/false counts
  and coverage independent of the active filter.
- UI tests cover retained markers with unavailable controls and valid filters
  when verified data exists.
- The actual 5182/8012 route registered and logged in a synthetic account, then
  removed that test account. A second synthetic account signed in and out in a
  real browser; it was also cleaned up. No user's credentials were requested.
- Browser displayed the 432-record directory and explicit 0/432 coverage.

Local changes and runtime verification do not constitute GitHub CI, merge or
academic submission evidence.
