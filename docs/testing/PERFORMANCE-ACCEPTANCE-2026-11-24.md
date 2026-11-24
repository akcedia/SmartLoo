# Search performance and accepted release deviation

Refs #61, #76, #82 and NFR-01 / NFR-T01. Tested application: `b2c031f779f2516476691b33cd30069054d1ffd3`. The final measurement used its clean detached checkout and the revision-labelled `smartloo:two-readers24` image. Later deployment-health metadata and workflow changes do not alter this search implementation.

10,000 synthetic facilities, 50 constant concurrent clients, the existing ten-request nearby/filter mix, a separate 60-second warm-up and 300-second measurement. One Linux application process, 2 CPU quota and 1 GiB API RAM, two app-owned read slots. PostgreSQL and k6 share the private local Docker network. No model, tile, cloud account or real directory traffic is included. The free Render plan is not claimed to have this CPU capacity or these measured timings.

| Metric | Final measurement |
|---|---:|
| Requests / successful 2xx checks | 85,510 / 85,510 |
| Unexpected non-2xx / HTTP failures | 0 / 0 |
| Mean | 175.10 ms |
| p95 | 253.74 ms |
| Throughput | 284.92 requests/second |
| Original requirement | Mean and p95 each <250 ms |

The mean passes. **The strict p95 threshold fails by 3.74 ms (about 1.50%).** The k6 threshold and exit result remain failed in the raw evidence. Neither the original requirement nor the benchmark threshold was relaxed or rewritten.

On 24 November project owner Özgür Kılıç accepted this specific small p95 deviation for the school-demo release and directed further performance tuning to stop. Record this as **release accepted with a documented performance exception**, not as a measured p95 below 250 ms. This decision is not instructor approval; instructor acceptance of the exception has not been verified.

The instructor's performance-testing artifact category can reference the completed measurement and this exception. It must not imply that the raw numerical target passed. Earlier complete failures and diagnostic-only runs remain available, with their own source/configuration scopes. The additional two-process comparison was interrupted after the owner's decision and is not final acceptance evidence; its private stores were cleaned.

Changes: reuse bounded app-owned read connections; preserve single-statement consistency without unnecessary BEGIN/COMMIT; validate numeric/null/UUID response data with a compiled schema; encode in the existing database worker; align read-worker admission with connection capacity. No response cache, result truncation, changed filters, invented source facts or reduced client load was used.

Remaining deployment acceptance, final hosted CI, report review and Learn delivery are separate steps. Public hosting must be checked at its own exact deployed revision.
