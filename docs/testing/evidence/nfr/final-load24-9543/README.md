# NFR-T01 final candidate load measurement

Date: 24 November 2026. Repository candidate: `9543ea65a2ade23940d958ab9b40af2cb8ec33bf`. Tested image: `smartloo:review-security24`, application revision `befd4226f226a6823a002ff473ba429788bf4b68`. The runner verified no differences between these revisions in `src`, `frontend`, `db`, `tests`, `requirements-runtime.txt`, and `docker/Dockerfile.cloud`. Image identity and DB versions/indexes are in `environment.json`.

## Result: latency requirement failed

50 constant concurrent virtual users; 10,000 synthetic facilities; 10 equally rotated nearby/filter requests; separate 60-second warm-up and 300-second measurement. No artificial user think time. One Uvicorn worker, 2 CPU quota and 1 GiB API RAM. PostgreSQL and k6 shared the local Docker network; PostgreSQL had no matching CPU quota. Existing idle development containers remained running. Host/container samples are retained; this is not an isolated physical benchmark or a Render Free benchmark.

| Measurement | Result | Required |
|---|---:|---:|
| HTTP requests | 16,406 | — |
| Successful 2xx checks | 16,406 / 16,406 | All |
| HTTP failure rate | 0% | 0% |
| Mean latency | 913.89 ms | <250 ms |
| p95 latency | 1,432.00 ms | <250 ms |
| Throughput | 54.63 requests/second | — |

Both latency thresholds failed (k6 measurement exit 99). Warm-up also failed latency thresholds (mean 891.44 ms; p95 1,266.91 ms). These results do not supersede previous runs as successful, and do not prove the cause of the slowdown. Different worker/resource configurations must not be compared as identical environments. The provisioning command returned nonzero; phase exit codes and complete JSON summaries are retained.

All load requests target the real nearby endpoint and SQL implementation. HTTP success checks alone do not establish correctness of every returned filter result; functional correctness has separate tests. Model calls, map tiles and external APIs were excluded. No production account or the 432-record live directory was used or changed.

## Cleanup and reproduction

The runner's final cleanup completed. A separate inspection confirmed no `smartloo-load82` containers, no `smartloo_load82_%` databases on the test server, and no `private-api.env` remaining in the run directory. Logs and resource samples contain no provider keys. The public evidence export uses an explicit allowlist and excludes private environment files.

The three retained harness files are copies of the executed local harness. To reproduce, copy them into the candidate worktree's ignored `.venv` directory, use a new run name, and invoke `quality_linux_load.py --run-name <new-name> --workers 1 --cpus 2` with the known local test PostgreSQL server on port 5439. The main runner resolves its repository root relative to that location. It requires the pinned k6 image and the revision-labelled built API image; it deliberately rejects differing application inputs. Do not target production or rerun while heavy scans/tests are active.

Next action: profile connection setup, SQL execution and response processing separately before choosing a fix. No application performance change or target relaxation was made in this measurement.
