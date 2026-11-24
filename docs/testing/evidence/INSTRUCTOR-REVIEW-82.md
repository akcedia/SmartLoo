# Instructor review #82 - Software testing evidence

[Yeşim Hoca's checklist, section D](https://github.com/akcedia/SmartLoo/issues/82) is a team checklist. This map records evidence and gaps for #60. Final acceptance is coordinated through Özgür and the instructor review.

| Review item | Evidence | Remaining |
| --- | --- | --- |
| Requirements-related tests | [TC/NFR matrix](../SOFTWARE_TESTING_REPORT.md#functional-traceability); [latest catalog and live suites](acceptance/main-7b824134.md); [separate TC-21 browser evidence](acceptance/tc21-browser-7b824134.md). | 7 automated instances remain failing; other manual and environment-gated checks remain open. |
| Code coverage | [Local Python scope](coverage/backend-7b824134.md) at 7b824134, 1631/2112 combined (77.23%). | 80% target and integrated coverage/lint. Current measurement includes service skips. |
| Performance tests | [NFR-T01 plan](nfr/nearby-load-runbook.md). | Historical short-run p95 was 358 ms. Execute the specified five-minute test against the fixed test environment. |
| Security tests | [Verified real-service authentication and authorization evidence](acceptance/main-180a2944.md), including session expiry, review ownership and account deletion; existing nearby input-safety tests documented via #72. | Full security and privacy acceptance remains open. |
| SonarQube | [Execution plan and evidence checklist](quality/sonarqube-runbook.md). | Obtain access and record the current scanner and quality-gate results after #95. |
| Penetration tests | [Assessment scope](quality/security-assessment-scope.md); formal findings pending. | Record findings and retest evidence from an authorized assessment of the isolated test deployment. Existing functional and authorization checks are separately scoped. |
| Software Testing Report | [Report](../SOFTWARE_TESTING_REPORT.md) and [review PDF](../SOFTWARE_TESTING_REPORT_DRAFT.pdf) in [#76](https://github.com/akcedia/SmartLoo/pull/76). | Internal review, instructor review and Learn submission. |
| TDD evidence | [#83 red/green record](../OPEN-NOW-FILTER-2026-11-22.md) with two initial failed cases and two passing cases after the fix; [PostGIS CI](https://github.com/akcedia/SmartLoo/actions/runs/45023240852/job/137210528044). | TC-07/18/27 also have [red/green evidence](https://github.com/akcedia/SmartLoo/issues/56#issuecomment-7102554132). Wider course review stays open. |
