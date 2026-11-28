# Instructor review response — PR76 / correction PR106

The correction is published on the required `test_work` branch in [#106](https://github.com/akcedia/SmartLoo/pull/106). The original [#76](https://github.com/akcedia/SmartLoo/pull/76) preserves the requested-changes review. The owner authorized consolidation through #106; this does not create an academic approval record.

| Requested correction | Implemented location |
|---|---|
| Branch named test_work | PR106 head is `test_work`; no original review was renamed away or dismissed. |
| Report organized around final results rather than daily history | 16-page `SOFTWARE_TESTING_REPORT.pdf`, source `SOFTWARE_TESTING_REPORT.md`: scope, explicit plan, requirement tests, coverage, NFR, security, Sonar, interpretation and limitations. Earlier diary is archived. |
| Map test files beyond the48 acceptance cases | Complete75-file matrix:43 Python modules,30 frontend files, Redis integration and Node guards, plus all48 acceptance IDs. |
| Requirement percentages and statement/branch/combined explanations | 100% FR/NFR linkage;46/48 automated IDs=95.83%; actual Python/V8/Sonar denominators and raw artifacts explained. |
| Actual result files with short READMEs | `coverage/README.md`, `nfr/README.md`, `quality/README.md` index actual JSON/XML/LCOV/k6/Sonar outputs, not pending plans. |
| Real penetration tool and disposition | Official pinned OWASP ZAP on disposable Docker; raw before/final reports, email validation/header fixes, regression and bounded scope are documented. |
| Sonar severity/file/action/reason table and interpretation | Full13-record table; gate OK, three inherited open MAJOR maintenance findings disclosed; no disabled rules. |

The 28 November submission-edition record identifies the exact PDF and unchanged runtime source. Academic review, repository merge, live deployment and Learn submission remain distinct. No Learn upload is claimed here.
