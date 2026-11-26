# Final local release review — 24 November 2026

Refs #61, #76, #82, #89. Application source: `6b8d047d81bf68619e1deec776299bc4c9038d95`. This packet is prepared locally. GitHub publication, exact-head hosted CI, main merge, production promotion, instructor approval and Learn delivery are separate events, not implied by these results.

## Changes and verification

- Reuse app-owned PostGIS read connections and release them at shutdown. Single-statement nearby reads use autocommit; write services retain their original transaction/coordination behavior. Two scoped search-worker slots match the pool limit without changing other services' worker limits.
- Preserve the nearby numeric/null/UUID contract with a compiled validator/encoder in the existing database worker. No result cache, result truncation or changed filter/spatial rules.
- Correct Yusuf's #89 mobile findings: border-box AI panel and translated explicit launcher name. Real Brave at 320/375 px had no horizontal overflow; at 375 px the panel edge was 375.2 px from fractional layout rounding. The guest/static preview did not use a backing API. Store and authenticated feature checks have separate scope.
- Include the previously approved home-screen icons/manifest while preserving the light-theme default and explicit saved preferences. Actual image HTTP checks verify the icon URLs, not installation on a physical phone.
- Prepare a manual, exact-CI/exact-live-revision deployment workflow. It requires a private hook secret and an observed run before deployment-pipeline completion can be marked. No automatic publication on push is introduced.

| Verification | Result | Evidence |
|---|---|---|
| Complete backend, private real PostgreSQL/PostGIS + MongoDB + scoped Redis | **557 passed + 59 subtests**, 0 failures/errors/skips. JUnit 616 includes the subtests. | [Summary](evidence/release-2026-11-24/backend-summary.json), [JUnit](evidence/release-2026-11-24/pytest.xml) |
| Backend coverage | **93.06% combined**, 2490/2627 statements and 688/788 branch destinations; all 29 modules, 11 inherited excluded lines, no module omitted. | [Coverage XML](evidence/release-2026-11-24/coverage.xml) |
| Frontend | **309 passed**, 25 files, production build passed; line 83.14%, statement 81.31%, branch 77.48%, function 78.70%. | [V8 summary](evidence/release-2026-11-24/frontend-coverage-summary.json), prior UI run and final image build |
| Focused final search/catalog/cloud checks | **110 passed**, zero failures/skips. Includes 53 catalog instances + 15 cloud cases; subsets are not additional to the full backend total. | [Log](evidence/release-2026-11-24/release-focused.log) |
| Actual final image, black-box HTTP assessment | **35 checks passed** against isolated synthetic stores. IDOR edit/delete, privilege escalation, forged token, input attacks, private paths, password length and repeated-login controls checked. | [Receipt](evidence/release-2026-11-24/security-http.json) |
| Actual image command | **13 HTTP checks passed**, UID 10001 and CA bundle verified, including manifest/icons and 200/401/422/404 boundaries. | [Receipt](evidence/release-2026-11-24/cloud-smoke.json) |
| Deployment admission code | **13 Node tests passed**. Workflow YAML and embedded JS parsed separately; no deployment was triggered. | [Log](evidence/release-2026-11-24/release-guard-tests.log), [runbook](../integration/manual-release-pipeline.md) |
| Runtime package audit | Zero known vulnerabilities in the fully pinned runtime inventory, including psycopg-pool 3.3.3. Application dependencies did not change afterward. | [Audit](evidence/release-2026-11-24/runtime-audit.json) |

The final local image ID is `sha256:acf044d1265f19f579eb646e75410351ec84e1012b1fedc07a7e3411141b7c61`, labelled with the application source above. Render will rebuild the accepted source; this local image is not a published registry artifact. TLS, signatures and authorization were not weakened.

## Performance acceptance

[Complete measurement and owner decision](PERFORMANCE-ACCEPTANCE-2026-11-24.md): **85,510 successful requests**, mean **175.10 ms**, p95 **253.74 ms**. The strict p95 target failed by **3.74 ms**; Özgür accepted that specific small deviation for the school-demo release. Raw failed thresholds remain. This is an accepted release exception, not instructor approval or a measured p95 below 250 ms.

The benchmark source `b2c031f` has the same `src/app.py`, `src/nearby_store.py`, `src/nearby_response.py`, migrations and runtime pins as this final release source; a Git diff verified identity. Later changes add deployment metadata/guards. One process, 2 CPU and 1 GiB staging resources are not claimed to match Render Free capacity. [Complete runs and diagnostic scopes](evidence/release-2026-11-24/performance-summary.json) retain their own sources. The two-process comparison was interrupted after the owner's decision; cleanup was verified.

## Final Sonar result and retained findings

The final scanner completed successfully: **gate OK**, overall coverage **87.0%**, line 90.5%, branch 80.5%, duplication 0%, bugs/vulnerabilities/security hotspots all **0**. The evaluated gate conditions are new-code coverage **97.5% ≥80%**, new duplication 0% and new violations 0. Conditions were not ignored. [Gate](evidence/release-2026-11-24/sonar-gate.json), [measures](evidence/release-2026-11-24/sonar-measures.json).

Three inherited MAJOR regex-maintenance issues remain open (backend/frontend email and legacy review PII redaction), with the mitigation boundary documented in the earlier final quality review. Four previously assessed native-table role false positives retain their documented disposition; no rule was disabled. This is AI-assisted local analysis, not independent accessibility/security certification. [Issues](evidence/release-2026-11-24/sonar-issues.json).

The first attempt failed because the Linux scanner could not follow a Windows Git-worktree pointer. The existing setup was restored with SCM publication and Git-ignore processing disabled, and an explicit source SHA. The failed log remains local; the successful scan imports both real coverage reports. SonarQube was stopped again after export. No application code was changed to hide that setup failure.

## AI, privacy and review boundaries

No new native Gemini request was made; Özgür explicitly chose the existing four review receipts on their original commits. Do not present these as a new native-model/real-store final-source acceptance run. [AI development/runtime trace](../AI_WORKFLOW.md) and [partial human labels](evidence/ai/human-review-ozgur-2026-11-24.md) distinguish observed mistakes, synthetic examples and human decisions. Seven output labels remain unreviewed; privacy filters were not relaxed to agree with grouped human approvals.

The 35-check black-box assessment is scoped to local API/application attacks. It is not a comprehensive independent penetration audit, browser-wide XSS assessment, cloud infrastructure audit or denial-of-service campaign. Automated and observed mobile accessibility checks do not establish a full WCAG/NVDA certification or measured map FPS. These limits remain visible in the report.

## Publication and delivery

Yusuf's #76 at `b0eba155` is preserved in a separate local report branch. Its Markdown and PDF have a three-page verification addendum, including the mobile image; old main failures retain their original scope. The local PDF has 13 pages and remains a review draft. Request Yeşim Hoca's review by 25 November; upload the approved PDF by 29 November after actual approval. Prepare the exact-main clean ZIP separately from the source candidate, and record actual Learn submission rather than infer it from a merge.

[Final checklist](FINAL-RELEASE-CHECKLIST-2026-11-24.md) tracks the remaining publication/deployment/submission steps. Neither a private hook secret nor provider settings were written to GitHub/Render while preparing this packet. No GitHub issue box, board card, remote branch/main ref, production data or Learn submission was changed.
