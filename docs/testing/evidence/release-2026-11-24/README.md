# Release verification receipts

See [final release review](../../RELEASE-REVIEW-2026-11-24.md) for source revisions, counts, exclusions, limits and the owner-accepted performance exception. JSON/XML files are primary machine-readable receipts. Original failed thresholds are retained; warm-up-only diagnostics are not five-minute acceptance runs.

The copied harness files were executed from an ignored `.venv` directory directly under the repository root. For reproduction, copy the relevant files there first; their root resolution intentionally assumes that location. Do not invoke these archived copies directly from this evidence directory.

- `assess_security.py`: actual Docker HTTP assessment, 35 checks, uniquely named private SQL/Mongo stores and scoped cleanup. Invoke with the revision-labelled built image, e.g. `python .venv/assess_security.py smartloo:release24`.
- `quality_two_readers_load.py`, `quality_nearby_load.py`, `nearby_load82.js`: same-source, one-process, 2-CPU/1-GiB API benchmark; 10,000 synthetic records, 50 constant clients, 60-second warm-up and separate 300-second measurement. Select a fresh `--run-name`; preserve previous evidence.
- Runners guard the known local PostgreSQL endpoint `127.0.0.1:5439`, container `smartloo-pr75-postgis-1`, and the local Mongo endpoint `127.0.0.1:27019`. These endpoints refer to isolated development services, never Neon/Atlas or production. Environment and index/version metadata are included in each performance run. Any other machine must provision/verify equivalent isolated services before adapting the guarded endpoints.

`release-scope.json` records the final image/source, tool versions and the fact that publication, merge, deployment and submission had not happened when this local packet was generated. These flags are historical receipt fields; later delivery receipts must record actual events separately.

No private environment files, provider keys, real accounts/comments or full native-provider responses are included. New native Gemini requests were explicitly declined by the project owner for this verification.

Exported terminal test logs normalize UTF-8/newlines and strip trailing spaces for repository formatting. Their content/results are unchanged; original logs remain in ignored local storage.
