# Manual, verified release pipeline

Refs #61 and #82. The new workflow is preparation until it is reviewed, merged, supplied with its private hook secret and executed successfully. Do not mark deployment-pipeline completion from the YAML file alone.

`Manual verified Render deploy` runs only through an explicit workflow-dispatch action on main. It requires all nine existing push workflows to have completed successfully for that exact SHA. The local guard tests reject missing, failed, in-progress, stale-commit and PR-only evidence. A private deploy-hook URL must target only the existing SmartLoo service. One POST requests that specific source SHA; an ambiguous result stops without an automatic re-trigger.

The workflow polls the public health endpoint for the exact Render-provided `RENDER_GIT_COMMIT`. An older release returning HTTP 200 is insufficient. After the exact revision appears, read-only checks verify static routes/manifest, guest ADMIN denial, invalid-coordinate rejection, missing-asset 404 and a nonempty real directory. The artifact records SHA, deployment ID when available, CI run links and observed HTTP checks. It does not call Gemini or write application data, and it does not replace authenticated or manual UI acceptance.

## One-time setup and controlled use

1. Keep the existing Render service on Free with auto-deploy off. No payment method, new service or paid add-on is required.
2. With Özgür's approval, copy the existing service's private Deploy Hook into the repository Actions secret `RENDER_DEPLOY_HOOK_URL`. Do not paste it into issues, code, chat or screenshots. The GitHub connection used here has no secret-management capability, so use the account settings UI or have Özgür enter it.
3. Review/apply compatible migration 008 separately after a recoverable database backup; no schema changes or resets occur in this workflow.
4. Merge accepted source and inspect all nine exact-main CI results. Explicitly run the manual workflow once, inspect the receipt and perform the authenticated/user UI smoke.
5. If triggering times out, inspect Render before any retry. On failure, use the previous successful Render deployment; do not drop tables or reset the directory. Record an actual rollback drill separately from this plan.

Official references: [deploy hooks and exact commit pinning](https://render.com/docs/deploy-hooks), [default runtime variables](https://render.com/docs/environment-variables). The public health response exposes a valid 40-character commit SHA only, not environment settings or credentials. Process liveness still does not prove every datastore or AI feature is ready.
