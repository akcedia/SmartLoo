# Final candidate quality review — 24 November 2026

Refs #55 #59 #60 #76 #82 #89 #101 #102. Local review evidence, not a claim of
main integration, deployment, instructor approval or Learn submission.

## Candidate and provenance

Tested application/dependency revision: `befd4226f226a6823a002ff473ba429788bf4b68`.
Subsequent local reconciliation includes main `ca6e93b` (#101/#102) and the
approved source-free CI trigger `33fee17`. Reconciled head `fe3b8d4` has exactly
the same Git tree as the tested revision (`git diff befd422 fe3b8d4` is empty).
Evidence-only changes after this record do not change that tested application.
See [machine-readable provenance](evidence/final-quality-2026-11-24/provenance.json).

The candidate preserves Emir's AI/policy/reason components and #99/#100, the
accepted map density/light default, suggestions/moderation and user suggestion
form, account/review integrity, analytics/export and shared session handling.

## Executed checks

| Scope | Actual result |
| --- | --- |
| Complete backend collection, actual private PostGIS/MongoDB and scoped Redis enabled | **547 passed, 0 failed/errors/skipped; 59 additional passing subtests**. JUnit has 606 passing testcase instances, including the subtests. Do not add those twice. |
| Backend coverage, all 28 src modules | 2431/2567 statements (94.70%); 683/782 branch destinations (87.34%); **3114/3349 combined (92.98%)**. Coverage's inherited 11 excluded lines remain explicit; no source module was omitted to raise the score. |
| Frontend with V8 coverage | **308 passed**, 25 files; build passed. Statements 81.31%, lines **83.14%**, branches 77.48%, functions 78.70%. This is separate from the backend target. All production JS/JSX is included; test/live files and the unsigned-JWT test helper are excluded. |
| Mounted UI through actual HTTP/stores, synthetic AI only | AI 4, moderation including user form 1, import 1, reviews 9, analytics 1, deletion 5: **21 passed**, zero failures/errors/skips. |
| Cleanup | Original 13 synthetic seed facilities retained; zero users, suggestions and review operations; private SQL DB removed. Mounted runners remove their unique Mongo databases. No public 432-record directory or real account was used. |
| Frontend package audit after adding the coverage provider | Zero known vulnerabilities. |
| Updated Python test environment audit | Zero known vulnerabilities across the 35 reported packages. |
| Actual cloud-image Python inventory audit | Zero known vulnerabilities; this is separate from auditing the test environment. |
| Cloud Docker build and actual-command smoke | Build passed. Root, sign-in, admin and health 200; missing asset 404; unauthenticated analytics 401; invalid latitude 422; UID 10001 and CA bundle verified. No external service credentials/network in the smoke. |
| Native model requests in this review | **0**. Earlier separately approved Gemini smokes retain their own revisions and limitations. |

Artifacts are in [the evidence folder](evidence/final-quality-2026-11-24/).
Backend counts/coverage and JUnit, frontend LCOV/summary, six mounted receipts,
dependency audits and image smoke are separate records rather than a combined
claim that every course requirement passed.

## Dependency security findings and correction

The initial installed-Python audit returned 13 advisory records across five
packages, including duplicate advisory IDs (11 distinct IDs). This is a package
finding, not proof an application endpoint was exploited.

| Package/scope | Before | Reviewed update |
| --- | --- | --- |
| certifi, runtime/test | 2026.7.22 | 2026.11.20 |
| opentelemetry-api, runtime/test | 1.45.1 | 1.45.2 |
| PyMongo, runtime/test | 4.10.1 | 4.20.1 |
| Soup Sieve, test HTML tooling | 2.10 | 4.0.0 |
| pip, install tooling | 26.1.2 in the audited environment | 26.2 in the isolated verification environment and cloud build |

Runtime/test pins stay aligned. An isolated new Python environment was used;
the developer's earlier work environments were not upgraded. The complete
backend and mounted real-store retests above used the new driver. The old audit
and old passing source measurements remain alongside the corrected records.

Primary references: [MongoDB driver security releases](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/release-notes/),
[OpenTelemetry advisory](https://github.com/open-telemetry/opentelemetry-python/security/advisories/GHSA-mf5v-w3w3-f6cg),
[Soup Sieve advisory](https://github.com/facelessuser/soupsieve/security/advisories/GHSA-mmhr-3c5m-f64f).
The audit JSON retains all advisory IDs and patch information, including pip and
certifi. Fresh audits are point-in-time evidence, not a permanent guarantee.

## SonarQube review and retest

Local server 26.11.0.134175; digest-pinned scanner 8.4.0.16527. Sources are src
and frontend/src; backend tests and frontend test/live fixtures are not production
source. SCM discovery is disabled for the Docker-mounted worktree and the exact
tested revision is supplied explicitly. Both actual coverage reports are imported.

1. Initial baseline `8c41151`: scan completed but gate **failed**. Overall 62.6%
   included frontend source without an LCOV report; new-code coverage was 61.3%
   and there were five new findings. Eight MAJOR maintenance findings were open.
   Zero bugs/vulnerabilities/hotspots. The initial Windows CLI argument error is
   also retained locally; it never completed a source analysis.
2. Fixed the dropdown's non-focusable radiogroup with `tabIndex=-1`; existing
   child-radio keyboard behavior is preserved. All frontend tests passed again.
3. Reviewed four S6843 findings on native td role=cell in a table role=table.
   [W3C permits this role](https://www.w3.org/TR/html-aria/#el-td);
   [MDN explains preserving table semantics when CSS changes display](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/rowgroup_role).
   At 375x812 in real Brave the cells have display:block and tabIndex -1, remain
   exposed as rows/cells under the facility table, and do not cause horizontal
   overflow. Existing explicit-role regression and the full 308-test suite pass.
   These four local maintenance issues were marked **FALSE-POSITIVE** with this
   rationale; roles were retained. The original failure export, exact disposition
   records and mobile AX tree are retained. No rule was disabled. This is an
   AI-assisted technical assessment, not independent human accessibility approval.
4. Final scan at `befd422`: scanner exit 0, gate **PASSED**, overall coverage
   **86.9%**, line 90.4%, branch 80.5%; bugs 0, vulnerabilities 0, hotspots 0,
   duplication 0%. Three existing MAJOR regex-maintenance findings remain open.

The final gate's actual evaluated conditions are new violations=0 and new
duplication=0. **There is no evaluated new-coverage condition in that final gate**;
do not cite the green alone as proof of a coverage threshold. Actual backend,
frontend and overall coverage figures above are separately retained.

### Remaining MAJOR maintenance findings

- Backend and frontend email regexes (S8786): validation checks the 254-character
  limit before applying the regex. Preserve that order and accepted email
  semantics. No unbounded-input exploit is established by this review.
- Review PII-redaction regex (S8786): API comments are capped at 1000 characters.
  Legacy/imported stored text requires a separate bounded-input/adversarial review;
  this residual path is not declared fixed. Do not simplify redaction at the cost
  of leaking personal data. These findings stay open with the mitigation boundary.

## Yusuf's latest report update and next release gates

Read #60's updated comment and #76 head `e9150a6`: Yusuf independently verified
main `46569db0` after #101 (295 frontend tests/build; unchanged main catalog 45/7,
no skips). Seven hosted workflows on that report head passed. His earlier 77.23%
measurement and browser checks remain scoped to `7b824134`; they are not wrong
because this unmerged AI/security candidate has newer passing results.

Coordinate the new evidence into #76 without overwriting historical failures or
claiming it was tested on main. Requested reviewer remains akcedia. Yeşim review,
approved PDF and Learn submission remain separate steps.

Still required: publish and review this local candidate with approval; inspect
hosted checks on the exact published AI head (none were recorded yet after the
one explicitly approved source-free CI trigger); final combined native-provider
and independent human Turkish evaluation; remaining visual/accessibility scope;
specified five-minute load run and a bounded hands-on security/penetration
assessment; final README/version/clean package and reviewed cloud release with
migration 008/settings/rollback. Short tests cannot prove a month of availability.

No main merge, deployment, issue/checklist tick or Learn submission is authorized
by writing this evidence. #101/#102 merges were separately approved and performed.
