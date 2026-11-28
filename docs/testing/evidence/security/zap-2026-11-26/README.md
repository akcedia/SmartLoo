# Actual OWASP ZAP assessment and retest

Target: disposable local Docker cloud application, private PostGIS/Mongo/Redis network, synthetic data only. AI disabled, no external network on the target network, zero native model calls, production untouched. Application-equivalent initial source: published `a683e9537b19affed79c6b03134454a83a302148`; fixed candidate: `3033321573bb66554df53a9a834b51312a8a61c3`.

Pinned official ZAP image: `ghcr.io/zaproxy/zaproxy@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af`.

Actual commands (on the private test Docker network, target alias `api`):

```sh
zap-baseline.py -t http://api:8000/ -m 1 -T 5 -J baseline.json -r baseline.html -w baseline.md
zap-api-scan.py -t http://api:8000/openapi.json -f openapi -T 5 -z "-config ascan.maxScanDurationInMins=10 -config ascan.maxRuleDurationInMins=1 -config ascan.threadPerHost=2" -J api-active.json -r api-active.html -w api-active.md
```

The baseline spiders and passively checks the SPA; the OpenAPI assessment actively attacks the imported API. `before/`, intermediate `after/` and authoritative `final/` retain raw JSON, HTML, Markdown and completion/exit receipts. Exit 2 means warnings remain; it is not a clean exit-0 result. No scan rules were ignored. No scanner session/API-key file or private env file is committed.

| Finding | Initial observation | Handling | Final result |
|---|---|---|---|
| Missing CSP (10038), Medium | SPA root lacked policy | Hash trusted inline boot/documentation scripts; constrain script/style/image/connect sources | Absent from final baseline/API alerts |
| Missing anti-clickjacking (10020), Medium | Root lacked protection | CSP frame-ancestors none and X-Frame-Options DENY | Absent |
| Missing nosniff (10021), Low | HTML/assets/OpenAPI headers absent | Add X-Content-Type-Options nosniff to cloud responses, including errors | Absent |
| Login HTTP 500 (100000), Low | Oversized email exceeded PostgreSQL login-failure column | Validate normalized length <=254 before database access; reject control characters incl. NUL in login/register | No final 5xx alert; boundary tests pass |
| Catalog HTTP 503 (100000), Low | The scanner fixture DB had no IBB import registry | Seed two synthetic GeoJSON records through the real importer. The intended uninitialized-source guard was preserved | No final 5xx alert; catalog returned 200 with 2 synthetic records |
| Unexpected content type (100001), Low, two instances | API scanner expects JSON for GET `/`; cloud root is deliberately HTML SPA | Contextual false positive. Preserve HTML root contract and raw alert; do not suppress rule | Remains Low; manually justified, not claimed fixed |
| Client errors (100000), Informational, 83 final instances | Invalid/missing parameters or unauthenticated/unauthorized requests | Expected 4xx validation and permission boundaries; cross-check actual regression suite | Informational, not zero-error claim |
| Modern Web Application (10109) / Authentication request (10111), Informational | Tool identifies SPA/login surface | Inventory notes; no vulnerability inferred | Retained |

Final baseline: 0 High, 0 Medium, 0 Low; one informational alert type. Final active API: 0 High, 0 Medium, one Low alert type (two expected HTML-root instances), two informational types. The login defect was reproduced with failing regression tests before the fix; final focused set: 38 passed. Full final suite: 572 passed +59 subtests. See `browser-regression.json` for the rendered UI/docs check after adding CSP.

Scope limit: this is an **unauthenticated automated assessment**, not an exhaustive authenticated penetration test. Role/ownership/IDOR and dependency checks are separately evidenced in the test suite and historical 35-case HTTP assessment. Local HTTP does not prove production TLS, and a tool finding count does not certify absence of vulnerabilities.

Official tool interpretation: https://www.zaproxy.org/docs/docker/baseline-scan/ and https://www.zaproxy.org/docs/docker/api-scan/ .
