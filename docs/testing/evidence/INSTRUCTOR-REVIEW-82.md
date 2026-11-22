# Instructor review #82 - Software testing evidence

[Yeşim Hoca's checklist, section D](https://github.com/akcedia/SmartLoo/issues/82) is a team checklist. This map records evidence and gaps for #60. Final acceptance is coordinated through Özgür and the instructor review.

| Review item | Evidence | Remaining |
| --- | --- | --- |
| Requirements-related tests | [TC/NFR matrix](../SOFTWARE_TESTING_REPORT.md#functional-traceability); [latest catalog and live suites](acceptance/main-180a2944.md). | 10 automated instances remain failing; other manual and environment-gated checks remain open. |
| Code coverage | [Full local Python scope](coverage/backend-6b1c5b2f.md) at 6b1c5b2f, 1467/1915 combined (76.61%). | 80% target and integrated coverage/lint. The 22 November rerun measured acceptance, with coverage evidence retained at its earlier revision. |
| Performance tests | [NFR-T01 plan](nfr/nearby-load-runbook.md). | Execute in the isolated Docker setup and publish measured results. |
| Security tests | [Verified real-service authentication and authorization evidence](acceptance/main-180a2944.md), including session expiry, review ownership and account deletion; existing nearby input-safety tests documented via #72. | Full security and privacy acceptance remains open. |
| SonarQube | [Execution plan and evidence checklist](quality/sonarqube-runbook.md). | Access, scanner run and actual quality-gate evidence. |
| Penetration tests | Formal assessment evidence pending. | Record findings and retest evidence from an authorized assessment of the isolated test deployment. Existing functional and authorization checks are separately scoped. |
| Software Testing Report | [Report](../SOFTWARE_TESTING_REPORT.md) and [review PDF](../SOFTWARE_TESTING_REPORT_DRAFT.pdf) in [#76](https://github.com/akcedia/SmartLoo/pull/76). | Internal review, instructor review and Learn submission. |
| TDD evidence | [#83 red/green record](../OPEN-NOW-FILTER-2026-11-22.md) with two initial failed cases and two passing cases after the fix; [PostGIS CI](https://github.com/akcedia/SmartLoo/actions/runs/45023240852/job/137210528044). | Focused evidence for this fix, with wider course review still open. |
