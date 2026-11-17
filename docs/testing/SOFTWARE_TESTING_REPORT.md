# SmartLoo Software Testing Report

Draft for #60. Internal review target: 20 November at 18:00 (Europe/Istanbul). Course deadline: 22 November at 23:59.

Current QA baseline: [main at 87994f9](https://github.com/akcedia/SmartLoo/tree/87994f967d430f1d8394465cd205d4b8e772b580). Historical runs retain their original revisions below. For each run, record commit, OS, tool versions, seed, commands, and an evidence link. Record Passed, Failed, Skipped, or Not run per case. Add the reason for failures or skips and link the issue and retest. Attribute existing contributor results to the original commit.

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

## Functional traceability

Sources: [requirements](../REQUIREMENTS.MD) and [test catalog](../../tests/requirements_cases.json).

| Case | Requirement | Scenario | Verification | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-01 | Nearby open toilets | test_tc_01 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-02 | FR-02 | Accessibility filter | test_tc_02 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-03 | FR-02 | Baby changing filter | test_tc_03 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-04 | FR-08 | Successful login | test_tc_04 | Not run | — |
| TC-05 | FR-03 | Reject guest review | test_tc_05 | Not run | — |
| TC-06 | FR-03 | Create review and aggregate | test_tc_06 | Not run | — |
| TC-07 | FR-05 | Suggest location | test_tc_07 | Not run | — |
| TC-08 | FR-04 | Structured Turkish AI summary | test_tc_08 | Not run | — |
| TC-09 | FR-06 | Filtered dashboard | test_tc_09 | Not run | — |
| TC-10 | FR-07 | CSV report export | test_tc_10 | Not run | — |
| TC-11 | FR-01 | Reject invalid search | test_tc_11 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-12 | FR-02 | Combined filters and clearing | test_tc_12 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-13 | FR-02 | Pricing filter | test_tc_13 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-14 | FR-01 | Empty nearby results | test_tc_14 | Passed | Main `24611dd`, isolated nearby pytest (above) |
| TC-15 | FR-04 | AI outage and insufficient reviews | test_tc_15 | Not run | — |
| TC-16 | FR-04 | Summary cache | test_tc_16 | Not run | — |
| TC-17 | FR-04 | Preference recommendations | test_tc_17 | Not run | — |
| TC-18 | FR-05 | Moderate suggestions | test_tc_18 | Not run | — |
| TC-19 | FR-07 | Idempotent CSV and JSON import | test_tc_19 | Not run | — |
| TC-20 | FR-07 | Invalid import is atomic | test_tc_20 | Not run | — |
| TC-21 | FR-09 | Initial map HTML and manual marker details | test_tc_21 | Not run | — |
| TC-22 | FR-09 | Map without geolocation | Manual UI | Passed | Özgür, #54 `71e8ce8`, 17 November handoff above |
| TC-23 | FR-09 | Filter markers remain consistent | Manual UI | Passed | Özgür, #54 `71e8ce8`, 17 November handoff above |
| TC-24 | FR-07 | JSON report export | test_tc_24 | Not run | — |
| TC-25 | FR-06 | Dashboard has no data | test_tc_25 | Not run | — |
| TC-26 | FR-03 | Edit and delete own review | test_tc_26 | Not run | — |
| TC-27 | FR-10 | Close reviewed facility | test_tc_27 | Not run | — |
| TC-28 | FR-04 | Untrusted review content | test_tc_28 | Not run | — |
| TC-29 | FR-10 | Invalid toilet coordinates | test_tc_29 | Not run | — |
| TC-30 | FR-08 | Case insensitive email | test_tc_30 | Not run | — |
| TC-31 | FR-03 | Invalid review rating | test_tc_31 | Not run | — |
| TC-32 | FR-03 | Duplicate review | test_tc_32 | Not run | — |
| TC-33 | FR-10 | Nonexistent toilet | test_tc_33 | Not run | — |
| TC-34 | FR-10 | Account deletion | test_tc_34 | Not run | — |
| TC-35 | FR-03 | Recalculate aggregate | test_tc_35 | Not run | — |
| TC-36 | FR-07 | Stable source identity | test_tc_36 | Not run | — |
| TC-37 | FR-08 | Weak password | test_tc_37 | Not run | — |
| TC-38 | FR-08 | Password storage and response | test_tc_38 | Not run | — |
| TC-39 | FR-08 | JWT claims | test_tc_39 | Not run | — |
| TC-40 | FR-08 | Generic login error | test_tc_40 | Not run | — |
| TC-41 | FR-08 | Missing token | test_tc_41 | Not run | — |
| TC-42 | FR-08 | Tampered token | test_tc_42 | Not run | — |
| TC-43 | FR-08 | Expired token | test_tc_43 | Not run | — |
| TC-44 | FR-08 | User cannot access admin | test_tc_44 | Not run | — |
| TC-45 | FR-08 | Admin access | test_tc_45 | Not run | — |
| TC-46 | FR-03 | Review ownership | test_tc_46 | Not run | — |
| TC-47 | FR-08 | Login throttling | test_tc_47 | Not run | — |
| TC-48 | FR-08 | Public registration cannot grant administrator privileges | test_tc_48 | Not run | — |

## Non-functional traceability

| Case | Requirement | Method and acceptance criterion | Result | Evidence |
| --- | --- | --- | --- | --- |
| NFR-T01 | NFR-01 | Staging with 10,000 synthetic facilities, record host and DB configuration; warm for 1 minute, run mixed nearby/filter requests with 50 clients for 5 minutes Mean and p95 each <250 ms; zero unexpected non-2xx responses; retain load report. Exclude external AI and tile traffic. | Not run | — |
| NFR-T02 | NFR-03 | Exercise protected write/admin endpoints with absent, expired, tampered, USER and ADMIN tokens First three 401; USER admin access 403; ADMIN succeeds. No unauthorized writes. | Not run | — |
| NFR-T03 | NFR-04 | Submit latitude 95, longitude 200, radius -50 and 50001, rating 0/6 and comment length 1001 Each returns 422 naming invalid input; stored state unchanged. This is a validation/security check, also functional. | Not run | — |
| NFR-T04 | NFR-02 | Record 100 cache-hit requests and 20 healthy uncached requests; separately force provider timeout Cache p95 <100 ms; uncached p95 <8 s; timeout fallback by 10 s. Record environment and provider/mock separately. | Not run | — |
| NFR-T05 | NFR-05 / NFR-06 | Test three viewport widths; keyboard-only map alternatives/details; axe/Lighthouse plus manual focus/contrast checks; 500-marker pan/zoom No horizontal overflow blocking actions; labels/focus usable; ≥30 FPS; Lighthouse accessibility ≥90; no serious/critical axe findings. Record throttling/hardware. | Not run | — |
| NFR-T06 | NFR-07 | Disable AI then perform search/filter/details; monitor public API each minute for a calendar month Core requests continue; AI unavailable message appears. Availability ≥99% measured separately; short tests do not prove monthly uptime. | Not run | — |
| NFR-T07 | NFR-04 / NFR-08 | Seed synthetic email/name/phone in reviews; capture AI request; deny location permission; delete account; inspect public responses and storage PII absent from AI request; no unconsented stored location; account identifiers removed and review text redacted where needed; hashes/secrets absent from responses. | Not run | — |
| NFR-T08 | NFR-09 | Run implementation lint, tests, build and branch coverage report All implementation checks pass and backend coverage ≥80%. Requirements red tests are evidence of pending implementation, not a passing implementation gate. | Not run | — |
| NFR-T09 | NFR-10 | Switch UI between Turkish and English across map, auth, errors and dashboard Labels/messages switch without losing filters; Turkish AI text remains explicitly identified. | Not run | — |

## Defects and retest

Record the affected requirement, reproduction steps, expected and observed results, owner, fix commit and retest evidence. Include the coverage report and its source scope, tools and exclusions. Keep passwords, tokens, and raw personal data out of evidence.
