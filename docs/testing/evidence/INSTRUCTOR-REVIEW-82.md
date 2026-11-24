# Instructor review #82 - Software testing evidence

[Yeşim Hoca's checklist, section D](https://github.com/akcedia/SmartLoo/issues/82) is a team checklist. This map records evidence and gaps for #60. Final acceptance is coordinated through Özgür and the instructor review.

The original table below retains its independently measured main/candidate scopes. The final local release addendum follows it; pending historical measurements are not silently relabelled as current passes.

| Review item | Evidence | Remaining |
| --- | --- | --- |
| Requirements-related tests | [TC/NFR matrix](../SOFTWARE_TESTING_REPORT.md#functional-traceability); [latest main catalog retest](acceptance/main-ca6e93b4.md); [latest draft AI evidence](acceptance/ai-9543ea65.md); [prior live-suite evidence](acceptance/main-7b824134.md); [separate TC-21 browser evidence](acceptance/tc21-browser-7b824134.md). | 7 automated instances remain failing; other manual and environment-gated checks remain open. |
| Code coverage | [Local Python scope](acceptance/main-ca6e93b4.md) at ca6e93b4, 1631/2112 combined (77.23%). | Main measurement includes service skips. [Draft candidate](acceptance/ai-9543ea65.md) reached 92.98% on equivalent application source with real services. Final release scope remains open. |
| Performance tests | [NFR-T01 plan](nfr/nearby-load-runbook.md). | Historical short-run p95 was 358 ms. Execute the specified five-minute test against the fixed test environment. |
| Security tests | [Verified real-service authentication and authorization evidence](acceptance/main-180a2944.md), including session expiry, review ownership and account deletion; existing nearby input-safety tests documented via #72. | Full security and privacy acceptance remains open. |
| SonarQube | [Execution plan and evidence checklist](quality/sonarqube-runbook.md). | [Draft candidate scan and gate](acceptance/ai-9543ea65.md) passed on equivalent tested source. Final release scope and three existing findings remain open. |
| Penetration tests | Final bounded assessment is linked in the addendum below. | Its scope and limitations are distinct from the earlier functional authorization checks. |
| Software Testing Report | [Report](../SOFTWARE_TESTING_REPORT.md) and [review PDF](../SOFTWARE_TESTING_REPORT_DRAFT.pdf) in [#76](https://github.com/akcedia/SmartLoo/pull/76). | Internal review, instructor review and Learn submission. |
| TDD evidence | [#83 red/green record](../OPEN-NOW-FILTER-2026-11-22.md) with two initial failed cases and two passing cases after the fix; [PostGIS CI](https://github.com/akcedia/SmartLoo/actions/runs/45023240852/job/137210528044). | TC-07/18/27 also have [red/green evidence](https://github.com/akcedia/SmartLoo/issues/56#issuecomment-7102554132). Wider course review stays open. |

## Final local release addendum — 24 November

Application `6b8d047`; [frozen evidence snapshot df667632](https://github.com/akcedia/SmartLoo/tree/df667632cebb657f2e34628b9fb5d6288583ac22/docs/testing/evidence/release-2026-11-24). Remote links become available after publication. This packet does not imply main merge, live deployment, instructor approval or Learn delivery.

| Item | New evidence | Completion boundary |
|---|---|---|
| Requirement-related tests | 557 backend functions + 59 subtests passed, zero failures/errors/skips; 68 catalog/cloud cases are a subset. | Exact published-head CI and accepted-main equivalence still need recording. |
| Coverage | All 29 modules, combined backend 93.06%; frontend line 83.14%. | Candidate source and frontend scope are separate. |
| Performance tests | 10,000 records, 50 clients, 60-second warm-up + 300-second measurement; 85,510 successful requests, mean 175.10 ms, p95 253.74 ms. | Strict p95 failed by 3.74 ms; project owner accepted that release exception, instructor exception acceptance unverified. |
| Security / penetration assessment | 35 actual Docker HTTP checks on isolated SQL/Mongo stores; zero known vulnerabilities in the pinned runtime inventory. | Bounded API assessment; no claim of independent full penetration/cloud/browser-XSS certification. |
| SonarQube | Final gate OK; overall 87.0%, evaluated new coverage 97.5% against 80%; zero new violations/duplication, zero bugs/vulnerabilities/hotspots. | Three inherited MAJOR regex-maintenance issues remain assessed, not declared fixed. |
| TDD evidence | Initial pool run 3 failed / 2 passed; later read-transaction check failed before correction; worker-admission test observed 12 concurrent calls before the bound was enforced. Final relevant tests passed. | Actual red logs retained; no separate historical red commits invented. |
| Report / PDF | Markdown addendum and 13-page review PDF, including the mobile proof image. | #76 publication, Yeşim reviewer assignment and approval; approved Learn PDF by 29 November. |

Source/methods, residual issues and links: [final release review](https://github.com/akcedia/SmartLoo/blob/df667632cebb657f2e34628b9fb5d6288583ac22/docs/testing/RELEASE-REVIEW-2026-11-24.md). Native AI receipts retain their original revisions; no new native requests were made. New human scoring remains partial. The manual release pipeline and source ZIP are prepared locally; pipeline execution, authenticated live smoke and actual code-ZIP upload remain distinct delivery events.
