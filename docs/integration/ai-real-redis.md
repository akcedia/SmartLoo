# #59 real Redis component verification — 18 November

This addresses the remaining 16–17 November cache check independently of
Fırat's unresolved PostgreSQL/MongoDB coordination. It does not complete the
joint writer/AI demo or approve the proposed shared consistency protocol.

## Scope and execution

New isolated workflow: `.github/workflows/ai-redis.yml`. It uses Redis
`7.4-alpine`, matching the shared Compose major/minor, and Python 3.11 with
test-only pinned `redis==8.1.0`. Existing `ci.yml`, shared dependency/environment
files and Compose are not edited. This new AI job is proposed for Yusuf's review;
it does not declare itself a required branch-protection check.

The workflow runs the 101 independent AI tests, then explicitly runs eight
checks against a real Redis server through `redis.asyncio` and the actual
`RedisSummaryCache` adapter. The review coordinator, provider and semantic
policies remain synthetic. No OpenAI key, live provider or private service is
needed. The optional integration module is not named `test_*.py`, so normal
unit/default pytest discovery does not silently try or skip live connections.

`integration.run_ai_redis_checks` returns failure on any error/failure, skip or
test count other than eight. Missing client/server/URL is an error, never a skip
or fake-server fallback. A JSON artifact records count, versions, elapsed time,
tested CI merge commit and run ID. The report never records the Redis URL or
credentials. The workflow fails if the evidence file is missing.

## Eight checks

1. UTF-8 roundtrip and actual server TTL near 21,600 seconds.
2. Real expiration of a deliberately one-second key returns a cache miss.
3. Two actual service reads reuse Redis and make one synthetic provider call.
4. Changed source revision uses a new Redis key; old keys may expire naturally.
5. Malformed JSON in an actual cache entry is replaced by valid generation.
6. Simulated repair state blocks an existing real cached summary.
7. Real async client connection failure at a deliberately closed loopback port
   preserves valid generation without caching. This is fault injection, not a
   Redis-server restart/shutdown demonstration.
8. Deliberately shortening a service key to one second causes regeneration and
   restores its six-hour TTL. No six-hour wall-clock wait is claimed.

The server is real, but database consistency, source revision changes and repair
state here use the existing in-memory coordinator model. These are Redis
component results, not full TC-15/16 acceptance or real multi-store recovery.
No HTTP/browser behavior or performance percentile target is measured.

## Local reproduction on an isolated test server

```sh
# In a suitable isolated Python environment, install redis==8.1.0.
# Point only at a disposable/test Redis, never an unapproved production service.
export SMARTLOO_AI_TEST_REDIS_URL=redis://127.0.0.1:6379/15
python -m integration.run_ai_redis_checks
```

The client uses RESP2 explicitly, bounded connect/socket timeouts and zero
automatic retries. Each test closes its async client and deletes only exact keys
that it created, using random UUIDs. There is no FLUSHDB/FLUSHALL or wildcard
deletion. This test-only URL name is not an agreed application environment name.
Application URL/client wiring still needs Yusuf/Özgür coordination.

The local machine had no Docker/Redis or redis-py at the initial check. Syntax
and the independent AI suite can run locally; a live Redis pass is reported only
after inspecting the dedicated CI job and its actual results.

Sources checked:
- [redis-py package and Python requirements](https://pypi.org/project/redis/8.1.0/)
- [Official redis-py async client lifecycle](https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html)

## Verified CI result

[Run 44320415440](https://github.com/akcedia/SmartLoo/actions/runs/44320415440),
code head `ecb7557c`, tested PR merge revision `b13c4c4b`:
**8 passed, 0 failures, 0 errors, 0 skipped** (suite 2.307 s; runner 2.333 s).
Server Redis **7.4.12**, redis-py **8.1.0**, Python **3.11.18**. The same job
passed the 101 independent AI tests (10.460 s). Existing review checks also
passed at run 44320415001. The JSON report was uploaded as an Actions artifact;
a source-linked copy is in ../evidence/ai-redis-2026-11-18.json.
This is real Redis component evidence; the provider/coordinator remain synthetic.
