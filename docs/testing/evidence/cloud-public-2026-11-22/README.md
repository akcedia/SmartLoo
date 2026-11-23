# Public cloud functional acceptance — 22 November 2026

Target: https://smartloo.onrender.com; deployed source identified by the user's Render receipt as `89abb21d9da61e648a46ca0b28f80f35fd2e2a8d` (PR #85). Live status, CI, main merge, instructor approval and Learn submission are separate gates. This run does not merge or approve a PR.

## Result

**40 public HTTPS checks passed**, with semantic assertions over HTTP responses and independent SQL/Mongo cleanup verification. The runner did not use the project owner's password or bearer token. It created two synthetic accounts and two explicitly labelled synthetic facilities under a unique source and district namespace. These fixtures were excluded from the public IBB directory; their coordinates were outside Istanbul's map searches. A temporary test account was promoted to ADMIN directly in SQL for the isolated ADMIN checks.

- Registration ignored a supplied ADMIN role and created USER accounts; real login succeeded. Guest review write returned 401, USER analytics/export returned 403, invalid score returned 422 and duplicate review returned 409. Another USER could neither edit nor delete the author's review (403).
- Real HTTP review creation, author edit and deletion updated detail count and score. Analytics used individual reviews: facility means 3.5 and 5.0 with counts 2 and 1 yielded the correct overall 4.0, rather than the unweighted facility mean 4.25. A score exactly 3.5 did not trigger the strict `<3.5` critical alert.
- ADMIN summary and JSON/CSV exports selected the same two synthetic facilities with identical hygiene values and date/district filters. CSV had a UTF-8 BOM and preserved the synthetic Turkish district name. Export attachment headers were checked. Missing/reversed date inputs returned 422; a district without data returned null score rather than zero.
- Europe/Istanbul inclusive-day behavior was tested via public analytics after directly setting only a synthetic review's timestamp: local midnight included; next midnight excluded and included in the following day's result. The original timestamp was restored. These boundary inputs were deliberately seeded through Mongo, not presented as clock-controlled HTTP review creation.
- Account deletion removed the synthetic USER, anonymized its remaining synthetic review, removed its identifying email/display-name text, preserved its score and rejected its old token. ADMIN deleted the anonymized review and its own review; summary/detail returned null averages and zero counts afterward. Deleting the temporary ADMIN invalidated its old token as well.

## Cleanup

All run-scoped review documents, recovery records, facilities, login-failure rows and synthetic accounts were removed. The independent checks reported **zero synthetic facilities/accounts/reviews remaining** and **432 IBB facilities both before and after**. The owner's existing account was not modified. No model calls were made.

## Evidence and reproduction

Related requirement cases (supporting public-service evidence, not a rerun of the complete catalog): TC-04 login, TC-05 guest review guard, TC-06 create/aggregate, TC-09 filtered analytics, TC-10 CSV, TC-24 JSON, TC-25 no data, TC-26 own edit/delete, TC-32 duplicate review, TC-34 account deletion and TC-45 ADMIN access. Their UI and other case-specific conditions still require the associated catalog/browser evidence; unrelated cases are not marked passed by this run.

`http-acceptance.json` contains only sanitized check labels/statuses and results, no passwords, JWTs, personal comments or connection strings. The execution helper was initially run from ignored private storage, then retained in the separate local integration checkout as `scripts/check_public_acceptance.py`; that helper and its private configuration are not introduced by this evidence-only change. This limits clean-checkout reproduction from this package alone. The helper was not rerun to create a second public data mutation unnecessarily.

Reproduction requires explicit authorization to create/remove synthetic records on the specified public app, matching saved Neon/Atlas credentials under ignored `.venv/`, and the service version under test. The runner has a fixed public target and a run-specific cleanup namespace. Do not reuse it against unrelated services or production user data. Provider credentials are never printed or passed as command-line arguments.

After squash merges #85 (`6b606db`) and #84 (`d28502c`), the user switched Render to main and confirmed the deployed revision `d28502c`. A separate **20-check read-only HTTPS smoke** then passed: see `main-readonly-smoke.json`. It retains count 432 and zero writes/model calls. The 40 mutation checks were **not** rerun on the new SHA; their tested source remains `89abb21`. Git comparison showed #85's complete tree equal to `89abb21`, and #84 added only a workflow and security-scope document. The original 40 results therefore remain identified separately rather than relabelled as a fresh main run.

## Limits / next gates

This is public API acceptance, not a real browser walkthrough, complete requirements-catalog pass, performance test, failure-injection/recovery proof or AI acceptance. It does not test provider outages, all races, mobile layout, routing/navigation, complete session expiry, final security/Sonar coverage, or monthly uptime. AI remains absent from the initial main-based cloud release. UI comment and export controls need a final human browser pass. Final reports must retain the source revision and scope of this evidence.
