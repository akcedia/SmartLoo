# Open-now filter: unknown working hours

## Change and scope

The city directory previously omitted `filter_coverage.open_now`. The map
therefore offered an open-only search even when the imported source contained
no usable schedules, producing an empty map. Unknown hours still must not be
treated as open.

The API now counts ACTIVE source facilities whose schedule can be interpreted
by the existing `opening_hours_is_open` function. This count is calculated over
the whole source before filters, in the same repeatable-read snapshot as the
other coverage counts. Malformed schedules and inactive facilities do not
enable the city open-only filter. No database migration or source data edit is
required; the nearby SQL query and its semantics are unchanged.

The city button uses the existing unavailable-filter behavior and shows the
schedule coverage. Nearby searches use their own returned facilities: when all
returned opening states are unknown, the button is disabled with an explanation.
Known `true` and `false` states both keep the filter available. Loading prevents
activating the open filter against stale results. An active filter can always be
cleared even if the source subsequently loses its schedule information.

## Local verification (22 November 2026)

- Before the API change: both focused real PostgreSQL cases failed because the
  expected `open_now` coverage key was absent. An earlier opt-in configuration
  attempt skipped the two cases; that attempt is not passing evidence.
- After the change: `tests/test_ibb_import_postgres.py -k directory_`:
  **2 passed, 5 deselected, 0 skipped**, with one existing TestClient deprecation
  warning. Tests create and drop their own uniquely named migrated databases
  on the isolated local test server (port 5439).
- Frontend `cityDirectory.test.jsx` and `map.test.jsx`: **18 passed**.
  Covers unavailable schedules, valid schedules, clearing a newly unavailable
  active filter, nearby null/true/false values, and preserved map/API behavior.
- Frontend production build succeeded; `git diff --check` passed.

These results are focused local checks, not a full acceptance run, browser
verification, GitHub CI, instructor approval or Learn submission. Existing
live directory records, accounts and reviews were not modified.

Codex prepared the implementation and regression cases at Özgür's request.
Human review, GitHub publication and deployment remain pending.
