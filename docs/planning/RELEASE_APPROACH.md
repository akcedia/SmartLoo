# Release and versioning policy

Refs #61 and #82. Product versions use `MAJOR.MINOR.PATCH`: incompatible contracts increment MAJOR, compatible features MINOR, fixes PATCH. `/api/v1` is separately versioned. Frontend package version `0.0.0` currently identifies its internal development package, not a released product version.

The first proposed school-demo version is `v0.1.0-rc.1`. A candidate is identified by an exact Git SHA, image ID/digest, migration set and evidence. The version becomes a release only after review, passing required gates and observed deployment. No tag or release is created by this document. An accepted stable demo may become `v0.1.0`; unresolved limitations remain in its release notes.

Feature/fix branches originate from current main and enter through PRs referencing requirements and #82. Review findings and actual tests accompany changes. Human peer review is distinct from AI-assisted inspection; missing peer review remains a gap rather than a backdated approval.

Deployment order: required CI on the accepted source; inspect database migration state and take a recoverable backup; apply only required additive migrations; publish the accepted source to main with approval; manually deploy that exact main revision in the existing free Render service; verify HTTPS, health, catalog, login/ADMIN and AI/fallback; record the Render deployment/revision. Keep existing settings and auto-deploy policy unless explicitly changed.

Rollback uses Render's previous successful deployment. Do not drop tables or reset data to roll back application code. Verify the previous application remains compatible with additive migration 008 before promotion. A written rollback plan is not proof that an actual rollback drill occurred.

Use pinned source, migration and package inventories for the final clean source ZIP. Exclude credentials, local data, generated dependencies and caches. Generate a SHA-256 manifest and verify archive contents. Instructor approval, PDF delivery and Learn ZIP submission are separate recorded events.

The 17 November course announcement moves test PR/reviewer assignment to 25 November and approved PDF delivery to 29 November. Charter's original test-report date was 22 November; its codebase date remains 30 November 23:59. The team targets completion by 29 November. Do not rewrite the historical Charter to hide the changed course dates.
