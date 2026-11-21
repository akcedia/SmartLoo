# SmartLoo Software Testing Report

Draft for #60. Internal review target: 24 November. Test-document PR and Yeşim Hoca reviewer assignment: 25 November. Learn PDF submission after PR approval: 29 November. The announcement specifies dates without times. Özgür coordinates reviewer assignment and Learn submission. [Updated course calendar](https://github.com/akcedia/SmartLoo/issues/60#issuecomment-7059811141).

Current QA baseline: [main 6b1c5b2f](https://github.com/akcedia/SmartLoo/tree/6b1c5b2f8dc30988edd6107e0f9c2c8b3a999e5c). Results below retain the tested revision and test scope.

| Area | Evidence to collect |
| --- | --- |
| Setup | PostGIS migration, SQL checks and synthetic seed, MongoDB and Redis health, backend and frontend startup, second contributor setup. |
| CI and real DB | SQL, nearby search and frontend checks, then MongoDB on #50 and PostgreSQL authentication on #51 after the PRs target current main. Record executed and skipped counts, integration flags and JUnit artifacts. |
| Browser | Verify #54 with real fixtures: 2 open facilities, 1 free facility, 2 after removing only the free filter. Verify a separate full reset, permission denial, manual center, rapid changes, stale selection, mobile size and loading/empty/error states. |
| Accessibility | Review #65 with physical keyboard input, focus and contrast checks, axe and Lighthouse. Record viewport, browser and findings. |
| Integrated features | Verify auth, review CRUD, statistics, admin analytics/export and AI cache/fallback on real services. |
| Security | Record local/staging scope, method, findings, fixes and retests for access control, input validation, dependencies, secrets and personal data. |
| SonarQube | Record server/project, scanner version, commit, findings and retest. Analysis is pending. |

## Early execution evidence

| Revision | Environment | Executed checks | Result |
| --- | --- | --- | --- |
| Main `24611dd` | Windows, Node 26.13.1, npm 11.20.0 | `npm ci`, `npm test`, `npm run build` in frontend | 38 tests passed and build passed. |
| Map PR #54 head `ad91e37` | Windows, Node 26.13.1, npm 11.20.0 | `npm ci --no-audit --no-fund`, `npm test`, `npm run build` in frontend | 37 tests passed and build passed. Tests were the admin suite on the PR head. Live map validation is pending. |
| QA setup PR #66 `f02bdfa` | GitHub Actions, Linux | Compose health for PostGIS, MongoDB and Redis, PostGIS migration and SQL checks, isolated and real PostGIS search, frontend test/build | [Required CI jobs passed](https://github.com/akcedia/SmartLoo/actions/runs/43927503558). Full requirements results are collected by the non-blocking baseline job. |
| Main `24611dd` | Windows, Python 3.12.10 | `python -m pip check`, isolated nearby pytest (`tc_01 or tc_02 or tc_03 or tc_11 or tc_12 or tc_13 or tc_14`), local Uvicorn HTTP smoke | No broken dependencies. 10 passed, 42 deselected. OpenAPI HTTP 200, invalid nearby latitude HTTP 422. OpenAPI emitted duplicate operation ID warnings for pending review routes. |
| PR #65 `187d1b6` | Windows, Node 26.13.1 | `npm test`, `npm run build -- --outDir ../../qa65-build` | [125 tests passed, including 25 accessibility tests. Build passed.](https://github.com/akcedia/SmartLoo/pull/65#issuecomment-6926576126) Manual browser and scanner results pending. |

## 17 November handoff evidence

[Özgür’s independent verification record](https://github.com/akcedia/SmartLoo/issues/60#issuecomment-6946980623) supplies the following results. These runs were performed by Özgür at the revisions listed.

| Revision | Verification | Result and scope |
| --- | --- | --- |
| #54 `71e8ce8`, merged as `5781eb4` | Real FastAPI/PostGIS and browser, 393 × 852 mobile view | Open facilities 2 → free 1 → open 2; stale card cleared; paid 1; full filter reset 3. Geolocation permission/denial, manual center, empty result and recovery after connection failure passed. 38 frontend tests and build passed. Rapid request races remain pending. |
| #66 `53b064d`, merged as `87994f9` | Separate clean setup on a second computer | All three Compose services healthy. PostGIS ALL CHECKS PASSED, MongoDB ok: 1 and Redis PONG. |
| #51 `4ebd147` | Real PostgreSQL auth and password byte boundaries | 18 passed, 0 skipped. |
| #50 `2be3e82` | Real MongoDB 7.0, PyMongo 4.10.1 | 6 passed, 0 skipped. |
| #70 `f2aabff` | Facility detail API | 6 detail tests, 5 real nearby tests and 10 isolated search tests. Detail 200/404/422 used real PostGIS; the 503 scenario injected a database failure. |

The new required suite gates run auth, MongoDB review reads and facility details independently. They reject missing reports, skipped tests, failures/errors and fewer than the expected passing cases (18 auth, 6 MongoDB, 6 detail). Each publishes JUnit evidence. Existing SQL, nearby, frontend and full acceptance baseline jobs continue to run.

Performance at the specified load, full integrated demo, rapid request races, manual browser accessibility and SonarQube results are pending. Final PDF review follows completion of this week's report evidence.

## Required suite CI results — 17 November

[Candidate validation run](https://github.com/akcedia/SmartLoo/actions/runs/44144525380) used QA commit `74c4010`, based on current main `87994f9`, with each exact feature revision merged independently in a disposable runner. The auth candidate resolved only the independent JWT and MongoDB/Redis additions to `.env.example`. Feature owners still review and merge their own PRs. Candidate-only CI wiring was removed after this run.

| Suite | Feature revision | Passed | Failed / errors | Skipped | Evidence |
| --- | --- | --- | --- | --- | --- |
| Real MongoDB review reads | #50 `2be3e82` | 6 | 0 / 0 | 0 | [MongoDB job](https://github.com/akcedia/SmartLoo/actions/runs/44144525380/job/134255911910) |
| Real PostgreSQL auth and isolated password byte boundaries | #51 `4ebd147` | 18 | 0 / 0 | 0 | [Auth job](https://github.com/akcedia/SmartLoo/actions/runs/44144525380/job/134255912383) |
| Facility details, real PostGIS plus injected failure case | #70 `f2aabff` | 6 | 0 / 0 | 0 | [Detail job](https://github.com/akcedia/SmartLoo/actions/runs/44144525380/job/134255912832) |

Each candidate job passed the JUnit gate and uploaded its report. Existing SQL, nearby and frontend checks also [passed on the QA change](https://github.com/akcedia/SmartLoo/actions/runs/44144525231). Eight local guard checks verified success and rejection of skipped/import-skipped, empty, missing, incomplete, failed and error reports.

The permanent workflow discovers feature suites in the checked-out PR merge revision. A suite that existed in the base revision also remains required if its file is removed. This allows #50/#51/#70 to merge independently; their dedicated jobs activate once those test files are present. Expected modules missing within an active suite, missing dependencies, skipped cases or too few passing cases fail that job. The full acceptance catalog remains an independently published non-blocking baseline.

## 18 November QA update

[Independent QA record](QA-2026-11-18.md) contains the executed commands, scopes, browser measurements and defects.

- #73 `f61de4f`: 46 frontend tests and build passed. Shared session and review ownership contract defects block the logged-in comment demo.
- #68 `d9fa94df`: 117 independent AI tests passed locally. The real Redis component CI log confirms 8 passed with zero failures/errors/skips. A local missing-server negative control exited 1 with 8 explicit errors and zero skips.
- #67 `8c5d58f`: 13 isolated review-service tests passed. An authenticated author read still returns is_own=false.
- #65 `187d1b6`: keyboard focus checks passed. axe found no automatic violations in sign-in, registration and the sample dashboard. Dashboard contrast requires manual review and its hidden trend table causes 405 px document width at 360 px. Full NFR-T05 acceptance remains pending.
- Shared dependencies now include PyMongo 4.10.1, redis-py 8.1.0 and Windows tzdata 2026.6. Local connection and timeout choices are recorded in the QA runtime contract for the route owners.

Development-tool security update: Vite 8.3.8, Vitest 5.1.1 and React plugin 6.3.0 remove all 5 originally audited package findings. npm audit now reports zero vulnerabilities. Node 24 is used in CI. The QA baseline, #73 and #65 passed 38, 46 and 125 tests respectively with the updated tools, and their builds passed.

Full demo, load performance, remaining security/privacy checks, NVDA/Lighthouse and SonarQube evidence remain open. Integration findings have owners and source links in the QA record.

## 19 November independent work

[Daily record](QA-2026-11-19.md) documents the exact revisions, tools, commands and limitations. #65 edc8e020: 128 frontend tests and build passed; 360/768/1920 px sample-dashboard retest has no horizontal overflow. Keyboard regression passed. axe registration has 15 passing rules and no violations/incomplete; dashboard has 20 passing rules, no violations and a retained contrast incomplete. SVG label contrast was independently calculated as 5.958:1. The mobile defect is fixed; complete NFR-T05 remains open.

New nearby safety suite: 29 passed. With existing isolated nearby contract cases: 39 passed, 0 failed/skipped, 42 deselected. Invalid inputs do not reach the store; connection errors hide synthetic secret details. IPv4 loopback defaults and documented process settings match Compose. Real Windows latency was not measured. Current-baseline coverage: 28/31 lines, 2/2 branches, combined 90.91%, coverage 7.10.7. This excludes SQL/frontend/real-DB IO and unmerged features; it is not final application coverage acceptance.

The existing [18 November catalog log](https://github.com/akcedia/SmartLoo/actions/runs/44359417171/job/134996345479) was inspected: 52 parametrized requirements instances, 10 passed / 42 failed / 0 skipped, representing 7 passing and 39 failing automated TC IDs. Five additional PostGIS tests skipped only in that reporting job; the separate PostGIS gate runs them. The functional matrix now records these failed baseline cases instead of Not run. Separate feature-candidate evidence does not turn this unintegrated baseline into a pass. No blocked full-demo, SonarQube or live-DB performance work was started on 19 November.

The PDF accompanying this report is a review draft with pending acceptance visible. Final integrated evidence and Özgür's review remain required before submission.

## 20 November review handoff

Independent QA on #73 `25da0b91` (Windows, Node 26.13.1, Vitest 2.1.8, Vite 5.4.11): all 47 repository tests and the production build passed. Seven additional React/jsdom checks using the actual #62 session writer and synthetic HTTP responses passed. The map recognizes a signed-in user, includes the bearer header on review reads and shows edit/delete controls when ownership or permission fields allow them. Guest and expired sessions have no bearer header. A fixture matching the current #67 response (`is_own: false`, no owner ID or permission fields) still leaves an actual owner without controls. [20 November QA record](QA-2026-11-20.md).

[Onur's frontend evidence in #74](https://github.com/akcedia/SmartLoo/blob/7edf6f72e1af55dfb1d8cb3d081b0b47dbb7c93b/docs/testing/evidence/frontend-session-admin-2026-11-20.md) records an attributed local integration run on open branches with local route wiring, PostGIS 16-3.4, MongoDB 7.0, real JWT and synthetic reviews. A USER submitted a review from the map and the ADMIN panel showed a 2.33 mean and critical warning. Review create/edit/delete updated the panel and CSV. CSV and JSON respected the selection. Local integration evidence supports TC-04/09/10/24/25/40/41/42/44/45/48; the matrix retains the earlier baseline result. TC-34 still returned 501, and browser registration 409 and in-browser token expiry were not exercised in that run. This work used #73 f61de4f plus a temporary session patch. The regression above tested the later published fix separately.

Still open: shared `main` verification, #67 ownership metadata, the #71 server date-range limit and JSON filename header, the final AI service connection, SonarQube access, staging load measurements and remaining accessibility checks. The review PDF includes these pending results.

## 20 November post-merge verification (historical)

[Post-merge QA record](QA-2026-11-20-main.md) pins main `2ac2a60e`. The independent local run passed 94 frontend tests and build (zero dependency advisories), and 90 of 109 selected backend checks. The backend result comprises 33 passing and 19 failing parametrized acceptance cases and 57 additional passing checks. For the functional matrix, the latest results therefore replace the older unintegrated baseline. Manual TC-22/23 retain their attributed browser evidence.

The [#71 required CI](https://github.com/akcedia/SmartLoo/actions/runs/44787409325) logs confirm real database gate counts of MongoDB 6, auth 18, facility detail 6, reviews 35 and analytics/export 39; zero failed, errored or skipped in these five gates. The [live map](https://github.com/akcedia/SmartLoo/actions/runs/44787409528) and [live admin](https://github.com/akcedia/SmartLoo/actions/runs/44787409426) suites passed 9 and 1 respectively. These are merge-candidate CI checks. Özgür separately reports a live browser export check in [#71](https://github.com/akcedia/SmartLoo/pull/71).

The merged backend supplies ownership and permissions to the map and wires live analytics/export. The server date limit and JSON filename header are implemented. TC-34 is still 501 on this main revision. The author of [#75](https://github.com/akcedia/SmartLoo/pull/75) reports TC-34 passing on the open account-deletion branch. Integrated AI, SonarQube, staging load, remaining privacy and accessibility checks and formal submission stay open.

The documentation-only [#76 verification](https://github.com/akcedia/SmartLoo/pull/76) used the same merged application and test source as main 2ac2a60e. The five [required DB suites](https://github.com/akcedia/SmartLoo/actions/runs/44795336948) passed 104 checks, and the [live map](https://github.com/akcedia/SmartLoo/actions/runs/44795336960) and [live admin](https://github.com/akcedia/SmartLoo/actions/runs/44795336830) passed 10 checks. All seven suites had zero failures, errors and skips. The separate non-blocking acceptance catalog still contains failures.

## 21 November merged work and refreshed acceptance

[Latest QA record](QA-2026-11-21.md) pins main [fde33e2b](https://github.com/akcedia/SmartLoo/tree/fde33e2b6452b078ad5241bdc2f3a5c2d344aa1d). Independent Windows runs recorded **156 passing frontend tests and a successful build**, and **99 passed / 18 failed** in the selected backend run. The latter includes 34 passing and 18 failing parametrized acceptance cases. The matrix below records this revision; manual TC-22/23 retain their earlier browser evidence. TC-34 now passes in the local acceptance run.

Account deletion (#75 and #63) is merged. The [required deletion CI](https://github.com/akcedia/SmartLoo/actions/runs/44833351786/job/136623642678) passed 15 cases and the [live account UI](https://github.com/akcedia/SmartLoo/actions/runs/44833351701) passed 5. Neither suite skipped a case. Scoped checks include account removal, invalidation of old login/token, retention of review scores and anonymization. These mounted UI checks use real HTTP and databases with synthetic identities.

Merged analytics (#64) retains the live admin/export checks. Merged accessibility (#65) provides component keyboard and semantic checks; screen-reader, Lighthouse and map FPS measurements remain open. The [İBB import suite](https://github.com/akcedia/SmartLoo/actions/runs/44824809830) passed 37 checks with real PostGIS. The #77 contributor recorded 432 imported facilities and a repeat with zero inserts/updates. The separate ADMIN upload, historical usage-statistics integration and fresh visual acceptance remain open. The draft AI #68 [real-store/synthetic-model checks](https://github.com/akcedia/SmartLoo/actions/runs/44880493302) passed 30 HTTP and 4 mounted UI cases; main and live-model acceptance are pending.

## Latest test results and interpretation

The independent run on main 6b1c5b2f after #79 and #80 passed **42/52 automated acceptance instances (80.77%)**, with 10 failed and zero skipped. Across all collected local Python cases, **200/276 passed**, 10 failed and 66 service-dependent cases skipped. Seven passing subtests are outside those item counts. See the [per-case evidence and run context](evidence/acceptance/main-6b1c5b2f.md).

- #79: TC-06/26/35 now pass against the same isolated repository. Özgür's earlier 85031d2 catalog was 37/15 with no skips; his separate PostGIS/detail subset was 9 passed with no skips. The fde33e2b results remain historical.
- #80: TC-19 (CSV and JSON), TC-20, TC-29 and TC-36 now pass in local acceptance. The ADMIN upload UI is separate. The 10 remaining red instances cover AI, suggestions/moderation, facility closure and the frontend-root HTML contract.
- Backend coverage across 14 Python modules is **1184/1507 executable statements (78.57%)**, **283/408 branch destinations (69.36%)**, and **1467/1915 combined (76.61%)**. Frontend, SQL, tests, scripts and unmerged AI are outside the denominator. No source-line exclusions were applied. Local service skips limit exercised paths. [Coverage detail](evidence/coverage/backend-6b1c5b2f.md).
- Quality and performance evidence are pending. The [SonarQube plan](evidence/quality/sonarqube-runbook.md) and [nearby load plan](evidence/nfr/nearby-load-runbook.md) define scope, execution, acceptance and artifacts for Özgür's isolated environment. Visual accessibility and the merged AI acceptance also remain open.

## Functional traceability

Sources: [requirements](../REQUIREMENTS.MD) and [test catalog](../../tests/requirements_cases.json).

| Case | Requirement | Scenario | Verification | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-01 | Nearby open toilets | test_tc_01 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-02 | FR-02 | Accessibility filter | test_tc_02 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-03 | FR-02 | Baby changing filter | test_tc_03 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-04 | FR-08 | Successful login | test_tc_04 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-05 | FR-03 | Reject guest review | test_tc_05 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-06 | FR-03 | Create review and aggregate | test_tc_06 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-07 | FR-05 | Suggest location | test_tc_07 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-08 | FR-04 | Structured Turkish AI summary | test_tc_08 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-09 | FR-06 | Filtered dashboard | test_tc_09 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-10 | FR-07 | CSV report export | test_tc_10 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-11 | FR-01 | Reject invalid search | test_tc_11 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-12 | FR-02 | Combined filters and clearing | test_tc_12 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-13 | FR-02 | Pricing filter | test_tc_13 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-14 | FR-01 | Empty nearby results | test_tc_14 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-15 | FR-04 | AI outage and insufficient reviews | test_tc_15 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-16 | FR-04 | Summary cache | test_tc_16 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-17 | FR-04 | Preference recommendations | test_tc_17 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-18 | FR-05 | Moderate suggestions | test_tc_18 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-19 | FR-07 | Idempotent CSV and JSON import | test_tc_19 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-20 | FR-07 | Invalid import is atomic | test_tc_20 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-21 | FR-09 | Initial map HTML and manual marker details | test_tc_21 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-22 | FR-09 | Map without geolocation | Manual UI | Passed | Özgür, #54 `71e8ce8`, 17 November handoff above |
| TC-23 | FR-09 | Filter markers remain consistent | Manual UI | Passed | Özgür, #54 `71e8ce8`, 17 November handoff above |
| TC-24 | FR-07 | JSON report export | test_tc_24 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-25 | FR-06 | Dashboard has no data | test_tc_25 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-26 | FR-03 | Edit and delete own review | test_tc_26 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-27 | FR-10 | Close reviewed facility | test_tc_27 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-28 | FR-04 | Untrusted review content | test_tc_28 | Failed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-29 | FR-10 | Invalid toilet coordinates | test_tc_29 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-30 | FR-08 | Case insensitive email | test_tc_30 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-31 | FR-03 | Invalid review rating | test_tc_31 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-32 | FR-03 | Duplicate review | test_tc_32 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-33 | FR-10 | Nonexistent toilet | test_tc_33 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-34 | FR-10 | Account deletion | test_tc_34 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-35 | FR-03 | Recalculate aggregate | test_tc_35 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-36 | FR-07 | Stable source identity | test_tc_36 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-37 | FR-08 | Weak password | test_tc_37 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-38 | FR-08 | Password storage and response | test_tc_38 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-39 | FR-08 | JWT claims | test_tc_39 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-40 | FR-08 | Generic login error | test_tc_40 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-41 | FR-08 | Missing token | test_tc_41 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-42 | FR-08 | Tampered token | test_tc_42 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-43 | FR-08 | Expired token | test_tc_43 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-44 | FR-08 | User cannot access admin | test_tc_44 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-45 | FR-08 | Admin access | test_tc_45 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-46 | FR-03 | Review ownership | test_tc_46 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-47 | FR-08 | Login throttling | test_tc_47 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |
| TC-48 | FR-08 | Public registration cannot grant administrator privileges | test_tc_48 | Passed | [Main 6b1c5b2f acceptance evidence](evidence/acceptance/main-6b1c5b2f.md) |

Functional result labels describe the stated baseline, not the latest unmerged feature branches. Parametrized test instances and TC IDs are counted separately. Partial means evidence exists but one or more acceptance conditions remain open.

## Non-functional traceability

| Case | Requirement | Method and acceptance criterion | Result | Evidence |
| --- | --- | --- | --- | --- |
| NFR-T01 | NFR-01 | Staging with 10,000 synthetic facilities, record host and DB configuration; warm for 1 minute, run mixed nearby/filter requests with 50 clients for 5 minutes Mean and p95 each <250 ms; zero unexpected non-2xx responses; retain load report. Exclude external AI and tile traffic. | Not run | [Execution and evidence plan](evidence/nfr/nearby-load-runbook.md). |
| NFR-T02 | NFR-03 | Exercise protected write/admin endpoints with absent, expired, tampered, USER and ADMIN tokens First three 401; USER admin access 403; ADMIN succeeds. No unauthorized writes. | Partial | Partial auth candidate evidence only: #51 18 real/isolated cases; full integrated protected endpoints pending. |
| NFR-T03 | NFR-04 | Submit latitude 95, longitude 200, radius -50 and 50001, rating 0/6 and comment length 1001 Each returns 422 naming invalid input; stored state unchanged. This is a validation/security check, also functional. | Partial | Partial: 29 nearby safety checks passed on 19 November; rating/comment validation and stored-state acceptance on integrated DB pending. |
| NFR-T04 | NFR-02 | Record 100 cache-hit requests and 20 healthy uncached requests; separately force provider timeout Cache p95 <100 ms; uncached p95 <8 s; timeout fallback by 10 s. Record environment and provider/mock separately. | Partial | Partial component evidence: 117 AI tests and 8 real Redis checks at #68 d9fa94df; specified 100/20 latency sample measurements pending. |
| NFR-T05 | NFR-05 / NFR-06 | Test three viewport widths; keyboard-only map alternatives/details; axe/Lighthouse plus manual focus/contrast checks; 500-marker pan/zoom No horizontal overflow blocking actions; labels/focus usable; ≥30 FPS; Lighthouse accessibility ≥90; no serious/critical axe findings. Record throttling/hardware. | Partial | Partial: #65 edc8e020 mobile overflow fixed, keyboard/axe checks above; Lighthouse, map alternatives, FPS and live acceptance pending. |
| NFR-T06 | NFR-07 | Disable AI then perform search/filter/details; monitor public API each minute for a calendar month Core requests continue; AI unavailable message appears. Availability ≥99% measured separately; short tests do not prove monthly uptime. | Not run | — |
| NFR-T07 | NFR-04 / NFR-08 | Seed synthetic email/name/phone in reviews; capture AI request; deny location permission; delete account; inspect public responses and storage PII absent from AI request; no unconsented stored location; account identifiers removed and review text redacted where needed; hashes/secrets absent from responses. | Not run | — |
| NFR-T08 | NFR-09 | Run implementation lint, tests, build and branch coverage report All implementation checks pass and backend coverage ≥80%. Requirements red tests are evidence of pending implementation, not a passing implementation gate. | Partial | [Coverage detail](evidence/coverage/backend-6b1c5b2f.md). 1184/1507 statements; 283/408 branch destinations; 1467/1915 combined, 76.61%. Integrated coverage/lint acceptance open. |
| NFR-T09 | NFR-10 | Switch UI between Turkish and English across map, auth, errors and dashboard Labels/messages switch without losing filters; Turkish AI text remains explicitly identified. | Not run | — |

## Defects and retest

Record the affected requirement, reproduction steps, expected and observed results, owner, fix commit and retest evidence. Include the coverage report and its source scope, tools and exclusions. Keep passwords, tokens, and raw personal data out of evidence.

| Finding | Requirement and owner | Status and retest |
| --- | --- | --- |
| Shared session mismatch | FR-03/08, Furkan and Onur | Fix merged. Shared session component retest passed; live map checks passed on the #71 merge candidate. |
| Review ownership mismatch | FR-03 / REQ-SEC-05, Firat and Furkan | Backend ownership fields and frontend handling merged. Real-DB review and live map CI passed on the #71 merge candidate. |
| 360 px dashboard overflow | NFR-T05, Onur | Fixed for component scope. #65 edc8e020 document scroll width is 345 at 360 px viewport, matching client width. No horizontal overflow at 768/1920 either. Contrast SVG target review 5.958:1; axe incomplete remains documented. [19 November record](QA-2026-11-19.md). |
| Windows loopback mismatch | Local environment, Yusuf; auth store coordination Fırat | Nearby default and example process configuration now use 127.0.0.1. Driver-boundary default and override checks pass. Real latency not measured; unmerged auth store not changed. [19 November record](QA-2026-11-19.md). |

## Delivery decision and remaining dependencies

The updated report is ready for review. #60 remains open because full integrated acceptance is pending. #72 has merged. Final feature merges must retain the real-DB gates and pass them on their final revisions. Core auth, map, reviews and analytics are merged. Account deletion is merged and TC-34 has been retested. AI integration remains on its draft branch. SonarQube access is still pending Özgür. Real-DB performance, complete security/privacy acceptance and the shared fixed-revision demo were not started on 19 November because their prerequisites are missing.

The PDF is a review snapshot generated from this Markdown. Review the linked daily records for commands, environments and source evidence. The final PDF must be regenerated after pending results are available and reviewed before the course submission.
