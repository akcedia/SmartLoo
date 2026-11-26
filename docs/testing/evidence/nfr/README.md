# Executed non-functional results

The authoritative current-candidate load result is `final-candidate-2026-11-26/summary.json`, with complete raw k6 warm-up/measurement JSON, logs and environment/run receipt beside it. Source `3033321573bb66554df53a9a834b51312a8a61c3`. Method: 10,000 synthetic records, 50 clients, 60-second warm-up and separate 300-second measurement, single API worker limited to 2 CPU /1 GiB, private PostGIS/Mongo/Redis Docker network; Sonar and ZAP completed before measurement. No production traffic or model requests.

Current result: **PASS**; 116,433 requests, 0 failed, mean 128.60 ms, p95 167.26 ms. Original `<250 ms` thresholds are unchanged. See raw `measurement.json` thresholds and actual exit in `run.json`. This is a local benchmark, not Render Free-tier latency evidence.

The historical 253.74 ms p95 (24 November, source-specific prior receipt) remains an owner-accepted strict-threshold miss, not a teacher-approved pass. Older 358 ms and earlier failed runs are archived evidence, not current results. Do not replace those raw values with the current run.

Other NFR evidence: `../coverage/` authentication/privacy/cache/fallback tests; `../security/zap-2026-11-26/` real ZAP results; `../quality/` executed static analysis; `../release-2026-11-24/security-http.json` historical 35-case HTTP assessment; `../release-2026-11-24/runtime-audit.json` historical dependency audit. The main report explains exact scope and the remaining unmeasured mobile/WCAG/monthly-uptime/native-AI targets. The existing runbook is a reproduction procedure, not a substitute for these actual results.
