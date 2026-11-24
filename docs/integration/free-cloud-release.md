# Free cloud release preparation (#82)

This branch adds a same-origin Docker deployment to current main (base 180a294). It does not incorporate the pending AI PR or unpublished performance/quality branches. The original local combined staging app is separate and remains unchanged. Initial cloud deployment therefore has main's feature set; AI cloud activation requires the AI contribution to be reviewed and integrated separately.

## Resources and configuration

- Render Free, Frankfurt: a single nonroot Docker service serves the existing React build and FastAPI API on the same origin. Build file: `docker/Dockerfile.cloud`; Docker context: repository root; Root Directory: empty. Keep Free selected, payment methods absent and automatic deployment off. Manual dashboard setup must explicitly set these values: the existence of `render.yaml` does not configure a manually created service.
- Neon Free: existing PostgreSQL 16/PostGIS schema. Use direct host (not `-pooler`), existing `SMARTLOO_DB_HOST`, `SMARTLOO_DB_PORT`, `SMARTLOO_DB_NAME`, `SMARTLOO_DB_USER`, `SMARTLOO_DB_PASSWORD`. TLS uses `PGSSLMODE=verify-full`, `PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt`, `PGCHANNELBINDING=require`.
- MongoDB Atlas Free: `SMARTLOO_MONGO_URL` with TLS and credentials in provider secret settings only; `SMARTLOO_MONGO_DB=smartloo`. Before public review/account actions, configure Atlas Network Access for the service region's actual Render outbound addresses and verify application indexes/write/recovery behavior.
- Upstash Redis Free: TLS `rediss://` URL under `SMARTLOO_REDIS_URL`; database 0. It is reserved for pending AI runtime integration and is not used by main's AI placeholders.
- `SMARTLOO_JWT_SECRET`: a separately generated private secret at least 32 bytes long. No account or ADMIN password is baked into the application. No Gemini/OpenAI key is required for this initial main-based release.

No migrations, resets, demo seeds or directory downloads run at app startup. The user-approved hosting setup separately initialized Neon with seven existing migrations and imported 432 unique facilities from the earlier official public IBB snapshot (436 rows, four exact duplicates); users and personal comments were not copied. Directory import is not part of this PR's startup behavior. First-login and ADMIN bootstrap remain explicit setup steps after public datastore checks.

## Behavior and gates

The cloud factory replaces only the API-only home placeholder with static React serving. Root, sign-in, register, account and admin routes support direct browser navigation; existing API routes and authorization remain unchanged. Unknown API/asset paths keep 404. A missing frontend build prevents startup. Render's supplied `PORT` is honored; the container has one worker and runs as UID 10001.

`/healthz` reports process liveness only, not datastore/AI readiness. `scripts/check_cloud_image.py` tests the actual container command offline with a custom port, a 512 MiB limit, nonroot UID, CA bundle and seven HTTP checks. It does not measure Render's CPU limits, performance, browser rendering or remote datastore readiness.

The free Render service sleeps after 15 idle minutes and may take about a minute to resume. This release does not establish the 250 ms load target, uptime target, final coverage, teacher approval or any Learn submission. The public URL and release revision must be recorded only after an actual successful deploy. Do not mark #82 Cloud hosting or deployment pipeline complete based on this PR alone.

Reference documentation checked 2026-11-22:
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/docs/your-first-deploy
- https://neon.com/docs/extensions/postgis

## AI-assisted change record

The assistant prepared the cloud entry point, image, Blueprint and targeted navigation/error/authorization checks. The user approved publishing a separate branch and review PR; main merge and provider deployment are separate steps. An early test on the combined precursor caught home-route shadowing and Windows static-path normalization; these were corrected before the cloud package was selected. Private connection files stay in ignored `.venv/` and are not copied into this branch or its Docker build context. Human code review and public deployment verification remain pending.

## Main-based local validation

- Focused backend: 49 passed, zero skips, one dependency deprecation warning (cloud routes, nearby safety, password byte boundaries).
- `docker build -t smartloo-cloud:release82 -f docker/Dockerfile.cloud .`: succeeded, including frontend test gate and production build; runtime pip dependency check passed. Initial local build uses the default `unversioned` label; CI builds set `VCS_REF` to the source SHA.
- `python scripts/check_cloud_image.py --image smartloo-cloud:release82`: seven HTTP checks passed, including direct sign-in/admin pages, missing-asset 404, guest ADMIN 401, invalid nearby input 422. Nonroot UID and CA bundle confirmed; temporary network-disabled container cleaned up. Remote PostgreSQL/Mongo operations are not part of this offline check.
- `.github/workflows/cloud-image.yml` repeats the focused suite, tested image build and offline image smoke test on PR/main events. GitHub CI execution and public Render verification remain pending at preparation time.
