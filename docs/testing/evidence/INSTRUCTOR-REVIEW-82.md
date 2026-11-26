# Instructor requested-changes response map — PR76

This replaces the stale day-by-day checklist map. The 26 November requested-changes review is authoritative. The earlier statement that `test_work` was merely an example did not satisfy the explicit review instruction and has been corrected. Local branch: `test_work`; publishing a linked correction PR from that branch and updating PR76 awaits owner authorization. Renaming an existing PR head closes its PR, so the original review must be preserved instead. Existing review history must be retained.

| Review request | Prepared correction /evidence |
|---|---|
| Branch named test_work | Local `test_work`, descendant of the existing PR76 head and published main. Publish the candidate on `test_work` and the existing PR76 branch; open a linked correction PR from `test_work`, preserving PR #76 and its review. This remains a separate owner-approved action. |
| Final-release report rather than daily diary | Primary report rebuilt into scope, requirement tests, coverage, NFR, security, Sonar, interpretation and limits; historical narrative archived. No obsolete Sonar-pending cover or six stale failed acceptance rows. |
| All test modules mapped | Complete75-file matrix:43 Python,30 frontend, Redis suite and Node guard; all 48 TCs; mapping script rejects omissions. |
| Requirement percentage and coverage definitions | 10/10 FR,10/10 NFR=100% linked, 46/48 automated IDs=95.83%; conformance limits explicit. Actual statement/branch/combined fractions and differing Python/V8/Sonar denominators explained. |
| Actual results in three folders | coverage/README.md, nfr/README.md and quality/README.md point to raw current JSON/XML/LCOV/logs, five-minute k6 and Sonar exports. |
| Real penetration tool and finding handling | Official pinned OWASP ZAP baseline +active OpenAPI scan against isolated synthetic Docker target; before/final raw reports, real bug/header fixes, focused/full regressions and scope limits. |
| Sonar severity/file/action/reason table and interpretation | quality/SONAR-ISSUES-AND-ACTIONS.md and section7 include all 13 issue record;3 open MAJOR maintenance findings remain transparent; gate OK. |

Primary source: SOFTWARE_TESTING_REPORT.md /SOFTWARE_TESTING_REPORT.pdf. Candidate runtime source 3033321; published baseline a683e95. This map records local preparation, not instructor approval, GitHub publication, deployment or Learn upload.
