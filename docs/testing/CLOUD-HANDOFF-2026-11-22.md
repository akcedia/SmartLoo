# Public cloud handoff — 22 November 2026

Refs #55, #60, #76, #82. Report/evidence contribution from Özgür; Yusuf retains ownership of the final test report, matrix and PDF. This addition changes no application behavior and grants no merge, provider or submission approval.

## Deployment and functional evidence

- Public HTTPS app: https://smartloo.onrender.com. Render Free, Frankfurt, one Docker web service, auto-deploy off. The user confirmed main deployment `d28502c90645a0c5bc3920b4dd5c329256eefd95` after #85 and #84 were squash merged. Both feature branches were preserved. All seven main-push workflows completed successfully; the standalone import job still reports no executed import result until #81's files arrive.
- [40-check public functional acceptance](evidence/cloud-public-2026-11-22/README.md) at original deployed head `89abb21`: real HTTP auth, review CRUD/ownership/aggregates, ADMIN analytics/export, Istanbul date selection, account anonymization and token revocation. Two synthetic facilities/accounts were fully cleaned; 432 IBB records preserved. Counts are HTTP checks with semantic assertions, not 40 pytest cases or 40 catalog IDs.
- [20 read-only checks after main deployment](evidence/cloud-public-2026-11-22/main-readonly-smoke.json): home/assets/direct browser-route delivery, directory 432, detail/nearby, filter consistency and guest ADMIN denial. No browser rendering, mutation rerun, latency or AI success is claimed.
- [Sanitized provider receipts](evidence/cloud-public-2026-11-22/provider-checks.json): verified Neon TLS and installed PostGIS; Atlas authorized collection read with certificate verification; actual application Redis cache JSON roundtrip, TTL/expiry and scoped cleanup. Individual provider checks preceded public functional acceptance and retain their own scope.
- The owner independently registered and logged into the public site, then confirmed ADMIN panel access after a scoped authorized promotion. Passwords/tokens are not in this package. This human check is narrower than a complete browser test.

## Import CI independent review

[PR #84 review](evidence/pr84-review-2026-11-22/README.md): 14 detector/JUnit fixture checks plus one genuine mounted import success with zero failures/errors/skips on a separate local #84+#81 candidate. The private SQL/Mongo test data was cleaned. This is not GitHub Ubuntu evidence on that combined SHA and does not resolve #81's file-selection race or uncertain-network heading.

## Checklist implications and gaps

Cloud hosting now has real URL/revision/functional evidence; link it to #82 rather than calling hosting missing. Teacher acceptance and the actual checklist edit remain separate. PR #85 provides an image test pipeline and documented manual deployment; automatic provider deployment is deliberately off. Do not call this fully automatic end-to-end CD.

AI #68 remains draft and is not active in this main-based cloud release. Performance, security/penetration assessment, final coverage/Sonar, mobile/browser/accessibility, TR/EN and missing feature acceptance remain open. Earlier local quality/performance results must keep their own source/environment; they cannot be silently assigned to `d28502c`.

Free Render sleeps after idle periods. No 250 ms load acceptance or >=99% calendar-month uptime is proven. The real source has unknown accessibility, baby-care, fees and computable hours; empty true-filter results do not demonstrate positive amenity coverage. Preserve these limits in the report/demo.

## Report integration

Add this handoff to #76 without rewriting historical rows. Update the top-level status to distinguish latest cloud source from the older catalog/coverage baselines. Link the new evidence for supporting TC-04/05/06/09/10/24/25/26/32/34/45, preserving the full-case and UI limitations. Regenerate the review PDF after the Markdown updates. Internal review: 24 November; test-document PR and Yeşim Hoca reviewer: 25 November; approved PDF/Learn: 29 November. Review/merge is not instructor approval or proof of submission.
