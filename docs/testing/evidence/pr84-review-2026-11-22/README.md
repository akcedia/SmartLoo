# Independent PR #84 review — 22 November 2026

Reviewed Yusuf's `4273a1a493a30de21420395a458d9b735afbfbd0`, based on main `180a294`: two changed files, the mounted-import workflow and security assessment scope. No merge-blocking issue was identified in this scoped review. No GitHub review/comment, merge, push or checklist change was performed.

## Detector and evidence guard

Executed the exact shell block extracted from `.github/workflows/admin-import-live.yml` using Git Bash with `-eo pipefail`, seven tiny Git fixtures and genuine parent commits. Confirmed: the not-yet-introduced suite reports `required=false`; a complete introduced/retained suite reports true and succeeds; either missing file or deletion of both files after introduction reports true and fails. These are detector fixture checks, not application import tests.

The existing JUnit checker accepted one passing case and rejected six invalid evidence variants: empty, failure, error, skipped, malformed and missing. **14 fixture checks passed** in total. See `gate-fixtures.json`.

## Real mounted import on a separate combined candidate

Created a separate local worktree at #84's SHA, then a clean uncommitted merge of #81 `95d2efd78c4b7ee7c033a28834c3731f34806154`. The original checkouts and main were preserved; this combination was not pushed or deployed.

Installed the candidate's frontend lockfile dependencies. Ran the unchanged `scripts/check_map_reviews_live.py --suite import` against a newly created UUID PostgreSQL database on local test service port 5439 and the runner's unique MongoDB database on local service port 27019. Applied the existing migrations to the empty SQL database before execution. No public cloud or existing 432-facility database was used.

**1 mounted test passed, 0 failures, 0 errors, 0 skips**, runner exit 0. The actual JUnit checker with `--minimum 1` accepted the report (exit 0). This one compound test covers CSV/JSON/repeat, invalid batch, busy import and role behavior; it does not mean every import edge case is covered. Cleanup independently confirmed zero SQL facilities, users and recovery operations, and the runner cleaned its unique MongoDB. The owned temporary SQL database was then removed. See `combined-import.json`.

The run used Windows/Python 3.13, actual local Docker PostgreSQL/PostGIS and MongoDB, Node/Vitest and Git Bash. It verifies the relevant workflow commands on the combined candidate, not a completed GitHub Ubuntu job on the same combined SHA. #84 by itself still has no import UI suite, and its skipped service steps are not passing application evidence.

## Decision and remaining work

#84 is suitable to merge as preparatory CI/security-scope work, subject to the user's specific GitHub approval. It does not implement the formal security assessment, SonarQube scan or instructor acceptance. The scope document correctly keeps real personal data, third-party services and the live facility directory outside controlled security testing.

Do not treat this successful test as resolving #81's independently reproduced pending file-selection race or contradictory network-result heading. #81 still needs those fixes and their regressions before merge. After the corrected #81 lands, require the mounted suite on the actual shared GitHub candidate with zero skipped evidence.
