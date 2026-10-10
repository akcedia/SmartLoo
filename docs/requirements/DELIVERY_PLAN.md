# Requirements delivery plan

Date: 10 October 2026. Integration owner: Özgür Kılıç.

The required planning artifacts are [WBS](../planning/WBS.md), [PERT](../planning/PERT.md) and [Gantt](../planning/GANTT.md), derived from the Charter milestones. This checklist complements those artifacts; it does not replace them.

## Roles and artifacts

| Owner | Work | Evidence |
|---|---|---|
| Özgür | Search/filter BDD and report integration | Issue #2 and core commit ab59c968 |
| Yusuf | Functional/non-functional tests | Issue #3 and PR #10 |
| Emir | Data-source research and AI behavior | Issue #4 |
| Fırat | Data constraints and authentication | Issue #5 and ZIP attachment |
| Onur | Dashboard and report export | Issue #6 |
| Furkan | End-user map workflow | Issue #7 |

## Delivery sequence

1. Integrate contributions on `requirements_work` based on current `main`.
2. Check requirement/test traceability, API consistency and relative links.
3. Run functional red-stage tests and record the result in the report.
4. Review documented integration decisions with the team.
5. Commit requirements, planning artifacts, tests and minimal FastAPI application scaffold.
6. Open the requirements PR to `main` by 8 October; request `yesimyigitbasi` as reviewer.
7. Follow review comments; do not merge before the required review.
8. After approval, produce the final PDF and submit to Learn by 11 October 23:59.

Keep original contributor evidence. Integration work is recorded as integration,
not retroactively attributed as each member's authored code. The actual core issue
is #2 despite its title saying “Issue #1”; the QA issue is #3 despite its title
saying “Issue #2”. PR #10 currently says `Closes #2`; this should be corrected by
its author to refer to #3 before merge. Do not close the core task through that PR.

## Risks and mitigations

- İBB facility GeoJSON verified (422 features): validate freshness, license terms, identity mapping and statistics join keys during analysis.
- Conflicting contribution details: report section 2 records each normalization for review.
- Unimplemented services: TestClient requests reach explicit FastAPI routes returning 501, and behavioral assertions fail. This is requirements-stage boilerplate, not working software.
- Missing administrative records: export null/blank rather than fabricate cleaning timestamps or counts.

## Current package status

Requirements and NFR test specifications prepared; red-stage run result recorded in
[the requirements report](../REQUIREMENTS.MD). GitHub upload/commit, review request, approval and PDF
submission must be checked independently; creating this file does not complete them.
