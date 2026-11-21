# Backend coverage on 6b1c5b2f

Application scope: all 14 measured Python modules under src at commit `6b1c5b2f8dc30988edd6107e0f9c2c8b3a999e5c`. Coverage.py 7.10.7, Python 3.12.10, Windows. Ran the complete local pytest collection with branch measurement.

| Metric | Covered / measured | Rate |
| --- | --- | --- |
| Executable statements | 1184 / 1507 | 78.57% |
| Branch destinations | 283 / 408 | 69.36% |
| Combined coverage.py metric | 1467 / 1915 | 76.61% |

Coverage.py reports 323 uncovered statements, 125 uncovered branch destinations, 43 partially covered branches and zero explicitly excluded source lines. No application-file omit filter was used. Frontend, tests, SQL migrations, scripts, infrastructure and unmerged AI sources are outside the src scope. The 66 service-dependent cases skipped locally, so this run does not measure their execution. NFR-T08 remains open; the combined rate is below 80% and integrated coverage/lint evidence remains incomplete. The historical 28/31 statement sample applied to two modules at an earlier revision.

`coverage run --branch --source=src -m pytest tests -q --tb=no --junitxml=../delivery-tests.xml`, then `coverage json -o ../delivery-coverage.json`. Test process exit code 1; coverage report generation succeeded.

| Source file | Statements covered / measured | Branch destinations covered / measured |
| --- | --- | --- |
| src/accounts.py | 20 / 23 | 4 / 6 |
| src/admin_analytics.py | 129 / 136 | 23 / 24 |
| src/admin_import.py | 168 / 230 | 73 / 112 |
| src/analytics_store.py | 22 / 27 | 7 / 8 |
| src/app.py | 70 / 74 | 7 / 8 |
| src/auth.py | 156 / 195 | 25 / 34 |
| src/db.py | 4 / 5 | 0 / 0 |
| src/ibb_geojson.py | 104 / 106 | 53 / 54 |
| src/ibb_import.py | 64 / 118 | 18 / 42 |
| src/nearby_store.py | 9 / 23 | 0 / 6 |
| src/review_ai_coordinator.py | 53 / 59 | 14 / 16 |
| src/review_coordination.py | 100 / 161 | 13 / 32 |
| src/review_scores.py | 9 / 31 | 0 / 6 |
| src/reviews.py | 276 / 319 | 46 / 60 |
