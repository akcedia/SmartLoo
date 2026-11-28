# SmartLoo

**Software Test Plan and Testing Report**

CMPE 331 · Software Engineering Concepts

Learn assignment: 05 - Software Test Plan

Submission edition: **28 November 2026**

Test/evidence baseline: **26 November 2026** · CI status rechecked: **28 November 2026**

## Project team

Özgür Kılıç · Yusuf Selim Aksu · Emir Miraç İslamoğlu · Fırat Karadoğan · Onur Arda Buldağ · Ahmet Furkan Yardımcı

## Document guide

Scope and release identity · Test plan and responsibilities · Environment and counting rules · Requirement traceability · Code coverage · Non-functional results · Security and OWASP ZAP · SonarQube findings/actions · AI limitations · Reproduction and publication evidence

Appendix A contains the complete 75-file test mapping. Appendix B contains all 48 acceptance-case IDs. Raw result artifacts are linked to an immutable repository snapshot; the coverage figure is embedded in this PDF.

Repository: [akcedia/SmartLoo](https://github.com/akcedia/SmartLoo)

Review: [PR #106 / test_work](https://github.com/akcedia/SmartLoo/pull/106) · Original review: [PR #76](https://github.com/akcedia/SmartLoo/pull/76)

## 1. Scope, release identity and conclusion

This submission edition combines the testing plan, requirement traceability, executed results and interpretation for SmartLoo. Measurements are tied to the identified release candidate and evidence snapshot. The earlier daily working history is retained only as an optional [historical appendix](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/archive/REPORT-HISTORY-through-2026-11-25.md), not as the main report. The document was assembled on 28 November 2026; the full local measurements are from 26 November and the published CI status was rechecked on 28 November.

Tested runtime source: `3033321573bb66554df53a9a834b51312a8a61c3`. Published report/evidence snapshot: `d9b54e8bdd1b206a0d10956355134e066c437ab9`, branch `test_work`, [correction PR #106](https://github.com/akcedia/SmartLoo/pull/106). The runtime source files are unchanged between these two commits. The published application baseline for this assessment was `a683e9537b19affed79c6b03134454a83a302148`; deployment and test-candidate identity are separate. The candidate includes validation and browser-header fixes identified by the real local OWASP ZAP assessment. This submission edition changes presentation and adds an explicit test plan and publication references; no measured result is replaced or reclassified.

The complete backend run passed **572 pytest cases +59 subtests**, with zero failures/errors/skips. All 29 source modules were included. **309 frontend component tests across 25 files**, **14 Node release guards**, the production frontend/image build and the new Sonar gate passed. ZAP identified a real oversized-login-email HTTP500 and missing browser headers; these were corrected and retested. The load result below is from this candidate, not copied from an older release.

| Final measure | Observed result |
| --- | --- |
| Backend combined coverage | 93.21% |
| Frontend line coverage | 83.31% |
| Sonar gate /overall /new-code coverage | OK /87.1% /93.2% |
| Current local nearby load | PASS; mean 128.60ms, p95 167.26ms |
| Final ZAP baseline /active API | No High/Medium; one remaining Low API alert type is the expected HTML root (2 instances) |
| Requirement traceability | 10/10 FR +10/10 NFR linked (100%); conformance is qualified below |

## 2. Test plan, responsibilities and execution criteria

### 2.1 Objectives and scope

Validate the requirement-defined core journeys: public map/distance search and filters; registration/login and role boundaries; owned review creation/edit/deletion; ADMIN analytics and consistent export; facility suggestions/moderation and atomic import; account cleanup and linked-data consistency; grounded AI summary/recommendation contracts with safe fallback. The plan retains the current architecture and contracts rather than introducing additional product scope.

Quality objectives are reproducible evidence, requirement-to-test traceability, explicit failure handling and accurate interpretation of non-functional limits. Staff scheduling, IoT sensing, payments and native mobile application delivery are outside this test scope. Browser access to an external directions application is a UI handoff; it is not an in-house route-optimization claim.

### 2.2 Test levels and workflow

Unit/component tests exercise validation, service policy, cache identity, UI state and error presentation. Real PostgreSQL/PostGIS, MongoDB and Redis integration tests check persistence, geometry, role enforcement, consistency and failure recovery. HTTP and mounted React tests exercise the API/consumer boundary. Cloud-composition checks validate built assets, browser routes and headers. Performance tests and actual ZAP/Sonar executions provide separate non-functional evidence.

The execution workflow is: identify the candidate; provision and migrate disposable stores; seed known synthetic fixtures; run backend and frontend suites; build the production composition; exercise mounted/HTTP/browser flows; perform isolated security and load/static assessments; triage findings; add regression tests and rerun affected checks; freeze raw evidence and publish the review candidate. Heavy scans and the measured load phase are not run concurrently. Release acceptance is evaluated against declared criteria, not merely an absence of runtime crashes.

Tests use boundary values, negative inputs, role/ownership partitions, state transitions, idempotency and dependency-outage simulation. A discovered defect is recorded with its trigger, expected/actual behavior, correction, regression result and source identity. The ZAP-discovered login failure is an executed example of this cycle. Historical failed runs remain available instead of being silently relabelled.

### 2.3 Environment and test-data controls

Use uniquely named disposable SQL/Mongo test stores and a reserved Redis test database, with explicit integration-test flags. Fixtures include known coordinates, null/unknown source attributes, controlled prices/hours, owner/other-user/ADMIN accounts and deterministic review scores. Synthetic source import tests preserve source identities and do not alter the live directory. Unknown real-source amenities or schedules remain unknown.

Keep credentials outside version control and reports. Do not print passwords, hashes, signing keys or provider responses containing personal data. AI providers are faked for repeatable contracts; native-provider smoke evidence is explicitly labelled and quota-bounded. An unavailable dependency must produce an honest error/fallback rather than fabricated empty data. Cleanup is restricted to resources belonging to the test run; no load or active security scan targets production.

### 2.4 Ownership and triage

| Team member | Project test/implementation ownership |
|---|---|
| Özgür Kılıç | Backend analytics/detail integration, cross-service acceptance and release/report coordination |
| Yusuf Selim Aksu | QA evidence, real-store CI, infrastructure and deployment checks |
| Fırat Karadoğan | Authentication, SQL/Mongo consistency, reviews and account-deletion/security boundaries |
| Emir Miraç İslamoğlu | AI adapter, grounding, cache, timeout and fallback behavior |
| Onur Arda Buldağ | Shared frontend session/HTTP, ADMIN panel and accessibility/component behavior |
| Ahmet Furkan Yardımcı | Map, filter/detail/review UI, responsive interaction and directions handoff |

These assignments describe project ownership, not an assertion that each member personally executed every reported command. Failures are triaged to the owning service and coordinated through the repository's issues/PRs. Security/data-integrity or core-flow defects require correction and regression evidence; cosmetic and maintenance findings are documented with their impact and disposition. Retesting preserves the requirement and original threshold.

### 2.5 Entry, exit and acceptance criteria

Entry criteria: known source revision and dependency versions; valid configuration without committed secrets; reachable isolated stores and applied migrations; known synthetic fixtures; working test/build commands; explicit distinction between live-provider calls and fake-provider tests. Pause environment-dependent acceptance if these prerequisites fail; do not count skipped service tests as passed.

Execution exit criteria: required automated runs finish without unaccounted failures/errors/skips; all required CI workflows succeed on the published head; backend implementation coverage meets at least 80%; each declared requirement has an evidence path; defects and residual risks have an explicit disposition. The measured nearby-search target is mean and p95 below 250 ms for 10,000 records and 50 clients. Tool warnings, manual cases and incomplete quality targets are interpreted separately rather than converted to unconditional passes.

The reported candidate meets the stated automated execution, build, coverage and local search-load criteria. This is not blanket acceptance of all non-functional goals: monthly availability, full WCAG/mobile/FPS measurements, broad native-AI accuracy/latency and complete human AI evaluation retain the limitations documented below. Faculty review and actual assignment submission are independent process steps.

## 3. Environment, test layers and counting rules

Reproducible tests used synthetic facilities/accounts/reviews in disposable local PostgreSQL 16/PostGIS 3.4, MongoDB 7 and Redis 7.4 Docker services. The API candidate used the production cloud composition and frontend build. The scan target network had external egress disabled; no production datastore or real account was used. Python coverage 7.14.1 ran with branch measurement and `--source=src`. Vitest/V8 measured frontend source, excluding test files. AI test providers were deterministic; **no new native Gemini call** was made.

Backend commands: `python -m coverage run --branch --source=src -m pytest tests -q --junitxml=pytest.xml`, then coverage JSON/XML exports. Explicit service opt-ins were `SMARTLOO_TEST_POSTGIS=1`, `SMARTLOO_TEST_MONGO=1` and a private test Redis URL. Frontend commands: `npm ci`, `npm test -- --coverage`, `npm run build`. Release guards: `node --test tests/release_checks.test.cjs`. Build receipt: [cloud-build.log](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/coverage/cloud-build.log).

JUnit aggregate `tests=631` includes 59 subtests; it does not mean 631 independent test functions. There are 572 `<testcase>` records. The 53 acceptance-catalog instances are a subset of these 572 and are not added again. The 309 component tests cover 25 frontend files; five additional mounted frontend files are mapped separately. The frozen local matrix preserves its preparation-time evidence scope; subsequent published-candidate CI also passed the mounted suites. The workflow receipts in section 10 identify the exact candidate checks. The 14 Node guards are a separate runner. These layers are not collapsed into an inflated single total.

An initial local run had one health assertion fail because the inherited Render revision environment variable changed the expected liveness body. The final run explicitly cleared that deployment-only setting; no assertion was relaxed. A first Sonar import also failed because its source prefix resolved `src/src/...`; both the failed receipt and corrected import are retained. Final results are the retests identified here, not the initial failures.

## 4. Tests by requirement and requirement coverage

Requirement baseline: [REQUIREMENTS.MD](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/REQUIREMENTS.MD), [DB/security subrequirements](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/requirements/db-security.md) and the existing 48-case catalog. Every discovered test file has an explicit mapping; `scripts/build_test_traceability.py` rejects newly added/unmapped Python or frontend files. See [complete 75-file matrix](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/coverage/TEST-REQUIREMENT-MATRIX.md) and its [machine-readable source](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/coverage/test-requirement-map.json).

| Coverage definition | Numerator /denominator | Percentage /meaning |
| --- | --- | --- |
| Functional requirements with at least one linked test file | 10/10 | 100% traceability |
| Non-functional requirements with linked tests/evidence | 10/10 | 100% traceability; measured limits remain explicit |
| Acceptance IDs mapped to verification | 48/48 | 100% mapped |
| Acceptance IDs with passing automated instances | 46/48 | 95.83% automated IDs;53 instances passed |
| Manual acceptance IDs | TC-22 and TC-23 | Manual procedures; not invented executable passes |

These percentages measure requirement-to-test association, not code execution coverage, full BDD-sentence automation or 100% product conformance. A passing AI contract with a fake provider does not prove native-model quality; a linked availability test does not establish monthly uptime. TC-21 proves the built SPA shell/assets automatically; rendered-map acceptance additionally uses browser evidence.

| Requirement | Catalog cases | Broader tests | Interpretation |
| --- | --- | --- | --- |
| FR-01 Nearby distance search | TC-01, TC-11, TC-14 | 8 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-02 Accessibility / baby / price filters | TC-02, TC-03, TC-12, TC-13 | 9 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-03 Create, edit and delete owned reviews | TC-05, TC-06, TC-26, TC-31, TC-32, TC-35, TC-46 | 12 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-04 Grounded Turkish AI summaries and recommendations | TC-08, TC-15, TC-16, TC-17, TC-28 | 22 files linked; full paths in Appendix A | Automated fake-provider/cache/grounding checks passed; native and human acceptance limited (section 9) |
| FR-05 Suggest facilities and ADMIN moderation | TC-07, TC-18 | 7 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-06 District/date hygiene analytics and alerts | TC-09, TC-25 | 9 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-07 CSV/JSON import and filtered export | TC-10, TC-19, TC-20, TC-24, TC-36 | 18 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-08 Registration, login and role enforcement | TC-04, TC-30, TC-37, TC-38, TC-39, TC-40, TC-41, TC-42, TC-43, TC-44, TC-45, TC-47, TC-48 | 11 files linked; full paths in Appendix A | Automated contract/integration evidence passed |
| FR-09 Interactive map and marker details | TC-21, TC-22, TC-23 | 12 files linked; full paths in Appendix A | SPA shell/component tests passed; scoped rendered browser checks; TC-22/23 remain manual procedures |
| FR-10 Referential integrity and account deletion | TC-27, TC-29, TC-33, TC-34 | 14 files linked; full paths in Appendix A | Automated contract/integration evidence passed |

TC-08/15/16/17/28 and TC-21 are no longer shown as failing in the final matrix: their executable instances passed in the final run. The full catalog with all 48 IDs is in Appendix B. Manual TC-22/23 retain their procedure and scoped historical/browser evidence instead of a false automated status.

## 5. Code coverage: definitions, denominators and final results

| Measure | Covered /total | Result | Meaning |
| --- | --- | --- | --- |
| Backend statements | 2538/2674 | 94.91% | Executed Python statements |
| Backend branches | 700/800 | 87.50% | Executed control-flow destinations |
| Backend combined | 3238/3474 | 93.21% | Weighted statement +branch opportunities |
| Frontend lines | 1448/1738 | 83.31% | V8/Vitest frontend production-source scope |
| Frontend statements | 1719/2113 | 81.35% | V8/Vitest frontend production-source scope |
| Frontend branches | 1373/1770 | 77.57% | V8/Vitest frontend production-source scope |
| Frontend functions | 455/576 | 78.99% | V8/Vitest frontend production-source scope |
| Sonar combined | Imported Python +JS/JSX analyzer scope | 87.1% | Not an arithmetic mean of93.21 and83.31 |
| Sonar line /branch | Analyzer executable lines /conditions | 90.6% /80.7% | Cross-language measures |
| Sonar new code | Previous-version baseline review-8c41151 | 93.2% | Gate threshold >=80%; different subset |

Statement coverage counts executable Python statements reached at least once. Branch coverage counts possible control-flow destinations reached; a line can execute while one conditional outcome remains untested. Coverage.py's combined percentage is `(covered statements +covered branch destinations)/(all statements +all branch destinations)`: **(2538+700)/(2674+800)=93.21%**. It is weighted by opportunities, not the mean of 94.91% and 87.50%. Eleven inherited excluded lines remain declared; **no src module was omitted**.

Frontend line 83.31%, statement 81.35%, branch 77.57% and function 78.99% refer to different V8 counters. The shorthand backend 93% /frontend 83% /Sonar 87% compared different measures. The current exact values are 93.21% backend combined, 83.31% frontend lines and 87.1% Sonar combined. Sonar combines imported Python coverage and frontend LCOV through its own executable-line/condition definitions across languages, with a different denominator; it is not `(93.21+83.31)/2`. Its 93.2% **new-code** coverage concerns the unchanged previous-version baseline subset, not overall coverage. The raw XML/JSON/LCOV files allow independent inspection.

Interpretation: the backend exceeds the implementation target>=80%, but 136 statements and 100 branch destinations remain uncovered. Frontend branch 77.57% is weaker than its line measure; uncommon/error interactions deserve further work. A green gate is useful regression evidence, not proof that every behavior or security boundary is correct.

## 6. Non-functional tests and interpretation

| Requirement | Target | Result /limitation | Actual evidence |
| --- | --- | --- | --- |
| NFR-01 | Mean and p95 <250 ms; 10k records /50 clients | PASS: mean 128.60, p95 167.26 ms; 116,433 requests, 0 errors | nfr/final-candidate-2026-11-26/ |
| NFR-02 | Cache-hit p95 <100 ms; uncached <8s; timeout fallback <=10s | Cache identity, expiry/invalidation, bounded timeout/fallback tested. No full 100-hit/20-native-generation benchmark; native latency target not established. | Python AI tests; scoped Redis integration |
| NFR-03 | Hashing, 60-minute JWT, roles and throttling | Positive/negative auth, password byte limits, generic failures, login rate limits and ADMIN/ownership boundaries passed. | Auth/security modules in Appendix A |
| NFR-04 | Production HTTPS, safe inputs/text and no secret/hash exposure | Input/header regressions and actual local ZAP assessment completed. Historical HTTPS deployment smoke is separate; no production attack scan. | security/zap-2026-11-26/; historical release packet |
| NFR-05 | 360/768/1920px; mobile map <2s; ≥30 FPS with 500 pins | Scoped responsive UI evidence/component tests exist. No complete final 500-pin FPS +recorded mobile-network benchmark; not full conformance. | UI component files; scoped browser receipt |
| NFR-06 | Keyboard, focus, labels; WCAG 2.1 AA target | Focus/labels/menu component tests and bounded browser checks pass. No complete independent WCAG conformance audit. | Frontend accessibility test paths |
| NFR-07 | 99% monthly uptime; AI outage must not disable search | Provider/Redis/Mongo outage and fallback paths tested. Monthly99% cannot be inferred from a short observation. | AI/HTTP/error tests |
| NFR-08 | Location consent, deletion/anonymization and PII redaction | Deletion/consistency and restricted-policy PII guards pass; no new real location collected. Broad human semantic/PII acceptance remains incomplete. | Deletion/privacy/AI modules; partial human-review record |
| NFR-09 | Backend ≥80%; lint/test/build merge gates | All29 backend modules combined 93.21%;572+59 tests;309 frontend tests;14 guards; build and Sonar gate passed. All nine published-candidate workflows passed; see section 10. | coverage/ and quality/ |
| NFR-10 | TR/EN interface; Turkish AI summary | Settings/core labels and components tested; browser switched TR/EN. Some legacy map/detail strings remain Turkish in English mode. No universal translation claim. | i18n/settings component tests; browser-regression.json |

### 6.1 Current nearby-search load result

The same ten-request mixed spatial/filter workload used for the earlier benchmark was run against this candidate with 10,000 synthetic rows and 50 constant virtual clients. A 60-second warm-up preceded a separate 300-second measurement. API resources were one worker, 2 CPU and 1 GiB; PostgreSQL/PostGIS and API shared the private Docker network. ZAP/Sonar/full-suite executions had finished before measurement. Exact runner settings, k6 pinned digest, exit codes and raw values are retained in [the NFR packet](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/nfr/final-candidate-2026-11-26/summary.json).

Measurement: **116,433 requests**, **0 failed requests**, checks rate **100.00%**, mean **128.60 ms**, p95 **167.26 ms**. Original thresholds remain `avg<250` and `p(95)<250`; result **PASS**. This single local benchmark does not establish cloud cold-start latency or monthly service reliability. The previous 253.74 ms p95 remains a historical strict-threshold miss accepted by the project owner, not an instructor-approved pass; the current measurement does not rewrite that receipt. The network path is now private Docker-to-Docker; this is not a controlled before/after comparison isolating code changes from environment effects.

### 6.2 Resilience, UI, privacy and internationalization

Cache invalidation uses review changes/policy identity; provider timeout and Redis outage return safe fallback rather than preventing ordinary search. Mongo failure must surface as unavailable, not fabricated zero reviews. ADMIN analytics/export share filters, Istanbul day boundaries and individual-review averages; no reviews means null and the critical threshold remains<3.5. Deletion tests cover anonymization and interrupted cleanup/data integrity.

Keyboard/menu/focus tests and the local post-CSP browser check demonstrate bounded usability. They do not measure 500 visible markers at 30 FPS, all mobile network profiles, or complete WCAG 2.1 AA. TR/EN switching works for tested labels, but visible legacy detail/map strings can remain Turkish. These limits are carried forward without blanket NFR acceptance.

## 7. Security assessment, penetration tool and remediation

The requested real tool was **OWASP ZAP**, using the official pinned Docker image. A passive baseline assessed the SPA and an active OpenAPI scan exercised API endpoints in the isolated local Docker environment. Full commands, image digest, before/intermediate/final raw JSON/HTML/Markdown, exit codes and exact dispositions are in [the ZAP packet](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/security/zap-2026-11-26/README.md). No scan targeted the public Render application. The official tool descriptions distinguish [baseline](https://www.zaproxy.org/docs/docker/baseline-scan/) and [active API scanning](https://www.zaproxy.org/docs/docker/api-scan/).

| Finding /severity | What was done | Retest interpretation |
| --- | --- | --- |
| CSP and clickjacking headers /Medium | Added script-hash policy, frame-ancestors none and X-Frame-Options DENY | Absent from final alerts; actual map/theme/language/list/detail and Swagger/ReDoc browser rendering checked |
| Missing nosniff /Low | Added X-Content-Type-Options to cloud responses including assets/errors | Absent |
| Oversized login email /Low HTTP500 | Validate normalized email length<=254 before DB; reject control characters including NUL | Fixed; 15 new boundary/header regressions,38 focused tests passed, full 572-case suite passed |
| Catalog unavailable /Low HTTP503 | Correct scan fixture setup through real importer,2 synthetic GeoJSON records | Setup gap, intended uninitialized-source guard retained; no final 5xx alert |
| Unexpected root content type /Low | Root deliberately serves the HTML SPA; keep raw alert, no rule suppression | Contextual false positive; one Low alert type/two instances remains |
| 4xx/authentication/modern SPA /Informational | Keep validation/auth boundaries and tool inventory observations | 83 final client-error instances; not hidden or counted as exploitable findings |

Final baseline has no High/Medium/Low alert; final active API has no High/Medium, one Low type with 2 expected HTML-root instances, and informational observations. Both tools return exit 2 (WARN), not a clean exit 0. This is an **unauthenticated automated penetration assessment**, complemented by actual auth/ownership tests and the historical 35-case Docker HTTP assessment. It is not an exhaustive authenticated pentest or a security certification. Local HTTP findings do not prove production HTTPS. Historical dependency audits and HTTP receipts retain their own source/date scopes; they are not relabelled current rescans.

The defect-to-regression chain is preserved: initial failing email/header tests, source validation/header changes, green focused suite, full backend run and final ZAP scan. No legitimate password-byte boundary, login throttling or unknown-user generic response was weakened to satisfy the scanner.

## 8. SonarQube results, issue actions and interpretation

The corrected candidate scan completed with scanner exit 0 and gate **OK**: new-code coverage 93.2%>=80%, new duplication 0.0%<=3%, new violations 0. Overall 87.1%, lines 90.6%, branches 80.7%; bugs 0, vulnerabilities 0, hotspots 0. The exact revision and unchanged baseline are recorded in [sonar-result.json](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/quality/sonar-result.json) and [sonar-gate.json](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/quality/sonar-gate.json). No analysis rule was disabled.

The required issue table below includes every exported issue, including historical closed/false-positive records and the three still-open MAJOR maintainability issues. A resolved false positive is a disposition, not a source fix.

| Severity | File:line | Rule / status | Action and reason |
|---|---|---|---|
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:32` | javascript:S6843; RESOLVED/FALSE-POSITIVE | Historical reviewed semantic dl/dt/dd cell roles retained; the analyzer warning was classified false positive, not a code fix. Accessibility is checked by component tests; this is not full WCAG certification. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:33` | javascript:S6843; RESOLVED/FALSE-POSITIVE | Historical reviewed semantic dl/dt/dd cell roles retained; the analyzer warning was classified false positive, not a code fix. Accessibility is checked by component tests; this is not full WCAG certification. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:38` | javascript:S6843; RESOLVED/FALSE-POSITIVE | Historical reviewed semantic dl/dt/dd cell roles retained; the analyzer warning was classified false positive, not a code fix. Accessibility is checked by component tests; this is not full WCAG certification. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:42` | javascript:S6843; RESOLVED/FALSE-POSITIVE | Historical reviewed semantic dl/dt/dd cell roles retained; the analyzer warning was classified false positive, not a code fix. Accessibility is checked by component tests; this is not full WCAG certification. |
| MAJOR | `frontend/src/shared/ui/Dropdown.jsx:n/a` | javascript:S6852; CLOSED/FIXED | Historical accessibility fix: use native keyboard-operable controls / valid semantic markup. Closed analyzer finding; current frontend component tests pass. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:n/a` | javascript:S6843; CLOSED/FIXED | Historical accessibility fix: use native keyboard-operable controls / valid semantic markup. Closed analyzer finding; current frontend component tests pass. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:n/a` | javascript:S6843; CLOSED/FIXED | Historical accessibility fix: use native keyboard-operable controls / valid semantic markup. Closed analyzer finding; current frontend component tests pass. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:n/a` | javascript:S6843; CLOSED/FIXED | Historical accessibility fix: use native keyboard-operable controls / valid semantic markup. Closed analyzer finding; current frontend component tests pass. |
| MAJOR | `frontend/src/features/admin/components/FacilityTable.jsx:n/a` | javascript:S6843; CLOSED/FIXED | Historical accessibility fix: use native keyboard-operable controls / valid semantic markup. Closed analyzer finding; current frontend component tests pass. |
| MAJOR | `frontend/src/features/auth/validation.js:4` | javascript:S8786; OPEN | Retained as open maintainability debt. Bounded email (254 characters) or comment input (1000 characters), existing validation/security regressions and no new violation; complexity cleanup remains future work. Not claimed fixed. |
| BLOCKER | `src/auth.py:n/a` | python:S6437; CLOSED/FIXED | Removed the literal dummy password hash. Generate the timing-equivalence dummy hash from fresh random bytes; password/hash and failure-path tests retained. Closed; no production credential was embedded. |
| MAJOR | `src/auth.py:39` | python:S8786; OPEN | Retained as open maintainability debt. Bounded email (254 characters) or comment input (1000 characters), existing validation/security regressions and no new violation; complexity cleanup remains future work. Not claimed fixed. |
| MAJOR | `src/reviews.py:34` | python:S8786; OPEN | Retained as open maintainability debt. Bounded email (254 characters) or comment input (1000 characters), existing validation/security regressions and no new violation; complexity cleanup remains future work. Not claimed fixed. |


The three open regex-complexity findings are bounded by email/comment length validation but remain maintenance debt. No new critical/high-severity vulnerability is asserted from the issue list; static analyzer category/severity is not the same as ZAP risk. The former literal dummy password hash (BLOCKER rule S6437) is closed after generating the timing-protection hash from fresh random bytes. Accessibility fixes and historic semantic false-positive classifications are separately identified. Full measures, hotspots, scanner log and corrected coverage input sit in the quality folder with a short README.

## 9. AI evidence and known limitations

Deterministic providers exercise structured output, grounding, PII/injection rejection, cache invalidation, recommendation fallback and provider configuration. Native Gemini Free-tier smoke evidence is historical and limited by quota. No new Gemini request was authorized for this report correction, and none was made. An empty/insufficient-review summary safely returns unavailable/null rather than invented observations.

The human evaluation is **partial**: 28 grouped input labels and 3/10 grouped output labels; seven outputs were not evaluated. The original uniformly positive answers are retained, but output 03 contains an unsupported water assertion. It remains a technical grounding failure despite the grouped human approval. Restricted-policy fixture agreement is not broad Turkish-language accuracy, an independent blinded study or complete human acceptance. See [the unchanged human-review record](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/ai/human-review-ozgur-2026-11-24.md).

Remaining limitations are explicit: native AI latency/semantic acceptance, monthly 99% uptime, full mobile/FPS/WCAG measurement, incomplete English translation, and three inherited Sonar maintenance findings. No unavailable measurement is replaced by a claimed pass. Production verification is distinct from the local packet and published-candidate CI. Academic review and Learn submission are also separate events.

## 10. Reproduction, artifact index and delivery state

Current primary artifacts:

- [Coverage README](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/coverage/README.md): raw backend JUnit/XML/summary, frontend JSON/LCOV/logs, build, guards and complete traceability.
- [NFR README](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/nfr/README.md): executed current 5-minute load result plus the unchanged historical benchmark context.
- [Quality README](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/quality/README.md): actual Sonar gate, measures, issues, hotspot export and issue/action table.
- [Security README](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/security/zap-2026-11-26/README.md): real tool commands, all scan stages, remediation, regression and browser scope.
- [Historical release packet](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/evidence/release-2026-11-24/README.md): previous 35-case HTTP assessment, dependency audit and source-specific runs.
- [Historical diary appendix](https://github.com/akcedia/SmartLoo/blob/d9b54e8bdd1b206a0d10956355134e066c437ab9/docs/testing/archive/REPORT-HISTORY-through-2026-11-25.md): prior day-by-day record, superseded for final acceptance results.

Reproduce in fresh disposable services with explicit test flags; never point test/scanner/import runners at Neon/Atlas/production. Build the production Docker image, run the full backend and frontend commands in section 3, retain branch-enabled coverage, then run pinned ZAP on the private Docker alias and pinned Sonar with the correct `/usr/src` coverage root. Keep raw failed runs and classify them; do not alter acceptance thresholds or exclude source files to improve percentages.

### Publication and review record

The revised package was published from the required `test_work` branch in [PR #106](https://github.com/akcedia/SmartLoo/pull/106), linked to the original [PR #76](https://github.com/akcedia/SmartLoo/pull/76) and its 26 November requested-changes review. The original review history remains available. All nine workflows below passed on exact head `d9b54e8bdd1b206a0d10956355134e066c437ab9`; their status was reverified on 28 November. No new native model calls were made for this submission edition.

| Workflow | Result | Execution receipt |
|---|---|---|
| AI summary HTTP integration | Passed | [Run 45882371703](https://github.com/akcedia/SmartLoo/actions/runs/45882371703) |
| SmartLoo review checks | Passed | [Run 45882371806](https://github.com/akcedia/SmartLoo/actions/runs/45882371806) |
| Map review live integration | Passed | [Run 45882371805](https://github.com/akcedia/SmartLoo/actions/runs/45882371805) |
| Admin panel live integration | Passed | [Run 45882371721](https://github.com/akcedia/SmartLoo/actions/runs/45882371721) |
| Admin import live integration | Passed | [Run 45882371730](https://github.com/akcedia/SmartLoo/actions/runs/45882371730) |
| Free cloud image checks | Passed | [Run 45882371733](https://github.com/akcedia/SmartLoo/actions/runs/45882371733) |
| Account deletion live integration | Passed | [Run 45882371727](https://github.com/akcedia/SmartLoo/actions/runs/45882371727) |
| IBB source import checks | Passed | [Run 45882371728](https://github.com/akcedia/SmartLoo/actions/runs/45882371728) |
| AI Redis component checks | Passed | [Run 45882371834](https://github.com/akcedia/SmartLoo/actions/runs/45882371834) |

These successful workflows include real-store HTTP checks, Redis component checks and mounted UI integration for map/reviews, ADMIN analytics/import, moderation, account deletion and AI fallback. They complement the local full-suite coverage measurement; the counts and coverage denominators remain separate. No CI failure was overridden to mark a run successful.

Review status checked on 28 November: PR #106 is open with `yesimyigitbasi` requested as reviewer; no submitted review is recorded on that correction PR. The requested report corrections and successful CI do not themselves constitute a recorded academic approval. Submission to Learn is tracked independently of this PDF's preparation.

The Learn assignment is **05 - Software Test Plan**, due **29 November 2026, 23:59, Europe/Istanbul**, as shown by the current assignment and the 17 November course announcement. This supersedes the original 22 November testing date in the Charter. The report and embedded figure are self-contained; immutable GitHub snapshot links provide the underlying raw artifacts.


## Appendix A. Complete test-file traceability

43 Python test modules, 30 frontend test files (25 component +5 mounted), one Redis integration suite and one Node guard file: 75 mapped files. The JSON companion contains paths and JUnit counts from the frozen preparation packet. The table below also cross-references the subsequent successful candidate CI for mounted suites; it does not add these tests to the 309 component-test total.

| Test file | Requirements | Execution scope |
| --- | --- | --- |
| tests/test_account_deletion.py | FR-10, NFR-03, NFR-08 | passed; 8 cases |
| tests/test_account_deletion_integration.py | FR-10, NFR-03, NFR-08 | passed; 6 cases |
| tests/test_admin_analytics.py | FR-06, FR-07, NFR-03, NFR-04 | passed; 22 cases |
| tests/test_admin_analytics_integration.py | FR-06, FR-07, NFR-03, NFR-04 | passed; 12 cases |
| tests/test_admin_import.py | FR-07, NFR-03, NFR-04 | passed; 26 cases |
| tests/test_admin_import_postgres.py | FR-07, NFR-03, NFR-04 | passed; 9 cases |
| tests/test_ai_boundaries.py | FR-04, NFR-02, NFR-08 | passed; 18 cases |
| tests/test_ai_consistency_contract.py | FR-03, FR-04, FR-10, NFR-08 | passed; 15 cases |
| tests/test_ai_guarded_publication.py | FR-03, FR-04, NFR-08 | passed; 14 cases |
| tests/test_ai_openai.py | FR-04, NFR-02, NFR-08 | passed; 18 cases |
| tests/test_ai_recommendations.py | FR-02, FR-04, NFR-02 | passed; 16 cases |
| tests/test_ai_restricted_policy.py | FR-04, NFR-08 | passed; 16 cases |
| tests/test_ai_review_adapter.py | FR-03, FR-04, NFR-08 | passed; 12 cases |
| tests/test_ai_summary_service.py | FR-04, NFR-02, NFR-07, NFR-08 | passed; 18 cases |
| tests/test_auth_password_bytes.py | FR-08, NFR-03, NFR-04 | passed; 8 cases |
| tests/test_auth_postgres.py | FR-08, NFR-03 | passed; 10 cases |
| tests/test_auth_timing_dummy.py | FR-08, NFR-03, NFR-04 | passed; 3 cases |
| tests/test_cloud_app.py | FR-09, NFR-04, NFR-07 | passed; 15 cases |
| tests/test_facility_admin.py | FR-05, FR-10, NFR-03 | passed; 5 cases |
| tests/test_gemini_http_acceptance.py | FR-04, NFR-02, NFR-08 | passed; 4 cases |
| tests/test_gemini_provider.py | FR-04, NFR-02, NFR-08 | passed; 21 cases |
| tests/test_gemini_recommendation_followup.py | FR-04, NFR-02, NFR-08 | passed; 5 cases |
| tests/test_ibb_geojson.py | FR-07, NFR-04 | passed; 20 cases |
| tests/test_ibb_import.py | FR-07, NFR-04 | passed; 11 cases |
| tests/test_ibb_import_postgres.py | FR-07, NFR-04 | passed; 7 cases |
| tests/test_local_runtime.py | NFR-09 | passed; 4 cases |
| tests/test_nearby_pool.py | FR-01, NFR-01, NFR-07 | passed; 7 cases |
| tests/test_nearby_postgis.py | FR-01, FR-02, NFR-01, NFR-04 | passed; 5 cases |
| tests/test_nearby_response.py | FR-01, FR-02, NFR-01, NFR-04 | passed; 1 cases |
| tests/test_nearby_safety.py | FR-01, FR-02, NFR-04 | passed; 29 cases |
| tests/test_recommendation_http.py | FR-02, FR-04, NFR-02, NFR-04 | passed; 17 cases |
| tests/test_recommendation_wiring.py | FR-01, FR-04, NFR-07 | passed; 10 cases |
| tests/test_requirements.py | FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, NFR-03, NFR-04, NFR-08 | passed; 53 cases |
| tests/test_review_consistency.py | FR-03, FR-04, FR-10, NFR-08 | passed; 5 cases |
| tests/test_review_publication.py | FR-03, FR-04, NFR-08 | passed; 5 cases |
| tests/test_review_scores_mongo.py | FR-03, FR-06, FR-07, NFR-08 | passed; 6 cases |
| tests/test_reviews.py | FR-03, NFR-03, NFR-04, NFR-08 | passed; 18 cases |
| tests/test_reviews_integration.py | FR-03, FR-10, NFR-03, NFR-08 | passed; 7 cases |
| tests/test_suggestions.py | FR-05, FR-10, NFR-03, NFR-04 | passed; 9 cases |
| tests/test_summary_http.py | FR-03, FR-04, NFR-02, NFR-08 | passed; 14 cases |
| tests/test_toilet_detail.py | FR-01, FR-09, NFR-04 | passed; 6 cases |
| tests/test_turkish_ai_acceptance.py | FR-04, NFR-08 | passed; 42 cases |
| tests/test_zap_regressions.py | FR-08, FR-09, NFR-04 | passed; 15 cases |
| frontend/src/app/a11y.test.jsx | FR-09, NFR-05, NFR-06 | frontend component scope |
| frontend/src/features/admin/admin.live.jsx | FR-06, FR-07, NFR-03, NFR-08 | mounted integration passed in published-candidate CI; section 10 |
| frontend/src/features/admin/api/admin.test.js | FR-06, FR-07, NFR-04 | frontend component scope |
| frontend/src/features/admin/api/httpAdapter.test.js | FR-06, FR-07, FR-08, NFR-03 | frontend component scope |
| frontend/src/features/admin/components/components.test.jsx | FR-06, FR-07, NFR-05, NFR-06 | frontend component scope |
| frontend/src/features/admin/contract.test.jsx | FR-06, FR-07, NFR-04 | frontend component scope |
| frontend/src/features/admin/import/AdminImport.test.jsx | FR-07, NFR-03, NFR-04 | frontend component scope |
| frontend/src/features/admin/import/adminImport.live.jsx | FR-07, NFR-03, NFR-04 | mounted integration passed in published-candidate CI; section 10 |
| frontend/src/features/admin/import/importApi.test.js | FR-07, NFR-03, NFR-04 | frontend component scope |
| frontend/src/features/admin/moderation/moderation.live.jsx | FR-05, FR-10, NFR-03, NFR-08 | mounted integration passed in published-candidate CI; section 10 |
| frontend/src/features/admin/moderation/moderation.test.jsx | FR-05, FR-10, NFR-03, NFR-08 | frontend component scope |
| frontend/src/features/admin/moderation/moderationRace.test.jsx | FR-05, FR-10, NFR-03, NFR-08 | frontend component scope |
| frontend/src/features/auth/accountDeletion.live.jsx | FR-10, NFR-03, NFR-08 | mounted integration passed in published-candidate CI; section 10 |
| frontend/src/features/auth/accountDeletion.test.jsx | FR-10, NFR-03, NFR-08 | frontend component scope |
| frontend/src/features/auth/auth.test.jsx | FR-08, NFR-03, NFR-04 | frontend component scope |
| frontend/src/features/map/MapView.density.test.jsx | FR-09, NFR-05 | frontend component scope |
| frontend/src/features/map/ai.live.jsx | FR-04, NFR-02, NFR-08 | mounted integration passed in published-candidate CI; section 10 |
| frontend/src/features/map/cityDirectory.test.jsx | FR-01, FR-02, FR-07, FR-09, NFR-04 | frontend component scope |
| frontend/src/features/map/directions.test.jsx | FR-09, NFR-08 | frontend component scope |
| frontend/src/features/map/layout.test.jsx | FR-02, FR-09, NFR-05, NFR-06 | frontend component scope |
| frontend/src/features/map/map.test.jsx | FR-03, FR-04, FR-09, NFR-04, NFR-06 | frontend component scope |
| frontend/src/features/map/markerDensity.test.js | FR-09, NFR-05 | frontend component scope |
| frontend/src/features/map/recommendationPanel.test.jsx | FR-02, FR-04, NFR-10 | frontend component scope |
| frontend/src/features/map/reviewSession.test.jsx | FR-03, FR-08, NFR-03, NFR-08 | frontend component scope |
| frontend/src/features/suggestions/suggestion.test.jsx | FR-05, FR-08, NFR-03, NFR-04 | frontend component scope |
| frontend/src/shared/http/apiClient.test.js | FR-08, NFR-03, NFR-04 | frontend component scope |
| frontend/src/shared/i18n/i18n.test.jsx | NFR-10 | frontend component scope |
| frontend/src/shared/session/session.test.js | FR-08, FR-10, NFR-03, NFR-08 | frontend component scope |
| frontend/src/shared/settings/settings.test.jsx | FR-09, NFR-05, NFR-06, NFR-10 | frontend component scope |
| frontend/src/shared/theme/theme.test.jsx | NFR-05, NFR-06 | frontend component scope |
| tests/release_checks.test.cjs | NFR-09 | Node deployment guards |
| integration/ai_redis_suite.py | FR-04, NFR-02, NFR-07 | real Redis component passed in published-candidate CI; section 10 |

## Appendix B. All 48 acceptance-case IDs

| Case | Requirement | Scenario | Final status |
| --- | --- | --- | --- |
| TC-01 | FR-01 | Nearby open toilets | Automated passing instance(s) |
| TC-02 | FR-02 | Accessibility filter | Automated passing instance(s) |
| TC-03 | FR-02 | Baby changing filter | Automated passing instance(s) |
| TC-04 | FR-08 | Successful login | Automated passing instance(s) |
| TC-05 | FR-03 | Reject guest review | Automated passing instance(s) |
| TC-06 | FR-03 | Create review and aggregate | Automated passing instance(s) |
| TC-07 | FR-05 | Suggest location | Automated passing instance(s) |
| TC-08 | FR-04 | Structured Turkish AI summary | Automated passing instance(s) |
| TC-09 | FR-06 | Filtered dashboard | Automated passing instance(s) |
| TC-10 | FR-07 | CSV report export | Automated passing instance(s) |
| TC-11 | FR-01 | Reject invalid search | Automated passing instance(s) |
| TC-12 | FR-02 | Combined filters and clearing | Automated passing instance(s) |
| TC-13 | FR-02 | Pricing filter | Automated passing instance(s) |
| TC-14 | FR-01 | Empty nearby results | Automated passing instance(s) |
| TC-15 | FR-04 | AI outage and insufficient reviews | Automated passing instance(s) |
| TC-16 | FR-04 | Summary cache | Automated passing instance(s) |
| TC-17 | FR-04 | Preference recommendations | Automated passing instance(s) |
| TC-18 | FR-05 | Moderate suggestions | Automated passing instance(s) |
| TC-19 | FR-07 | Idempotent CSV and JSON import | Automated passing instance(s) |
| TC-20 | FR-07 | Invalid import is atomic | Automated passing instance(s) |
| TC-21 | FR-09 | Built SPA shell and separate rendered map acceptance | Automated passing instance(s) |
| TC-22 | FR-09 | Map without geolocation | Manual procedure; not an automated pass |
| TC-23 | FR-09 | Filter markers remain consistent | Manual procedure; not an automated pass |
| TC-24 | FR-07 | JSON report export | Automated passing instance(s) |
| TC-25 | FR-06 | Dashboard has no data | Automated passing instance(s) |
| TC-26 | FR-03 | Edit and delete own review | Automated passing instance(s) |
| TC-27 | FR-10 | Close reviewed facility | Automated passing instance(s) |
| TC-28 | FR-04 | Untrusted review content | Automated passing instance(s) |
| TC-29 | FR-10 | Invalid toilet coordinates | Automated passing instance(s) |
| TC-30 | FR-08 | Case insensitive email | Automated passing instance(s) |
| TC-31 | FR-03 | Invalid review rating | Automated passing instance(s) |
| TC-32 | FR-03 | Duplicate review | Automated passing instance(s) |
| TC-33 | FR-10 | Nonexistent toilet | Automated passing instance(s) |
| TC-34 | FR-10 | Account deletion | Automated passing instance(s) |
| TC-35 | FR-03 | Recalculate aggregate | Automated passing instance(s) |
| TC-36 | FR-07 | Stable source identity | Automated passing instance(s) |
| TC-37 | FR-08 | Weak password | Automated passing instance(s) |
| TC-38 | FR-08 | Password storage and response | Automated passing instance(s) |
| TC-39 | FR-08 | JWT claims | Automated passing instance(s) |
| TC-40 | FR-08 | Generic login error | Automated passing instance(s) |
| TC-41 | FR-08 | Missing token | Automated passing instance(s) |
| TC-42 | FR-08 | Tampered token | Automated passing instance(s) |
| TC-43 | FR-08 | Expired token | Automated passing instance(s) |
| TC-44 | FR-08 | User cannot access admin | Automated passing instance(s) |
| TC-45 | FR-08 | Admin access | Automated passing instance(s) |
| TC-46 | FR-03 | Review ownership | Automated passing instance(s) |
| TC-47 | FR-08 | Login throttling | Automated passing instance(s) |
| TC-48 | FR-08 | Public registration cannot grant administrator privileges | Automated passing instance(s) |
