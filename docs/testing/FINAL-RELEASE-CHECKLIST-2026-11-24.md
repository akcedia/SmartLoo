# Final release and submission checklist — 24 November 2026

Refs #61, #76, #82, #89. This is a local preparation record, not an authorization or claim of deployment/submission. Preserve older failures and each receipt's revision. The public GitHub checklist has not been changed by this document.

| Item | Evidence / required completion |
|---|---|
| Requirements tests and coverage | Final quality review plus the separately versioned final performance/mobile follow-up. Historical main failures remain historical until accepted source reaches main. |
| Performance | Five-minute measurement completed: 175.10 ms mean, 253.74 ms p95, 85,510 successful requests. [Owner-accepted release exception](PERFORMANCE-ACCEPTANCE-2026-11-24.md): strict p95 remains failed by 3.74 ms; the test artifact is complete, instructor exception approval unverified. |
| Security and penetration assessment | Bounded local HTTP assessment on synthetic real SQL/Mongo stores, dependency inventories and authorization tests. Scope and residual issues must be included in the report. |
| SonarQube | Final source 6b8d047 scanned successfully: gate OK, overall 87.0%, evaluated new coverage 97.5%, zero bugs/vulnerabilities/hotspots; three inherited MAJOR maintenance findings retained. [Final review](RELEASE-REVIEW-2026-11-24.md). |
| Mobile AI findings | Border-box sizing and translated launcher name verified in real Brave at 320/375 px; guest panel, API unavailable. Authenticated/data-bearing and native AI acceptance are distinct. |
| Human AI evaluation | 28 grouped input labels and 3 grouped output labels recorded; 7 outputs unreviewed. Not completed independent human acceptance. Do not fabricate labels to finish the checklist. |
| AI tooling and traceability | Root AGENTS.md and docs/AI_WORKFLOW.md, actual regression/failure receipts and existing contributor commits. |
| Versioning, README, clean source package | Release policy, current README links, reviewed tracked-file ZIP plus SHA-256 manifest. A local candidate ZIP is not Learn submission. |
| Code review and CI | Independent contributor comments retained; inspect required hosted checks on the final newly published head. AI assistance is not human peer approval. |
| Production promotion | Concrete approval, compatible additive migrations/settings, exact main revision deployment and observed live smoke. Existing cloud deployment is not automatically the final candidate. |
| Report and course submission | Update #76 and its PDF without erasing history, request Yeşim Hoca's review by 25 November; approved PDF to Learn by 29 November. Final code ZIP upload is separately recorded. |

The instructor's checklist describes deliverable categories; individual failed or unassessed requirements must remain visible even when a category has an artifact. Instructor approval and Learn receipt cannot be inferred from merges, screenshots of a local app, or this checklist.
