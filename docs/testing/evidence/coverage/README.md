# Final coverage and requirement mapping

Source candidate: `3033321573bb66554df53a9a834b51312a8a61c3`, local `test_work` branch, 26 November 2026. This is not a claim of production deployment or instructor approval.

- `backend-junit.xml`, `backend-test.log`, `backend-run.json`: 572 pytest cases plus 59 subtests; zero failures/errors/skips. JUnit's aggregate 631 includes the 59 subtests; do not count 631 independent cases.
- `backend-summary.json`, `backend-coverage.xml`: all 29 `src` modules, branch measurement enabled. No module is omitted; inherited exclusion lines are shown in the summary.
- `frontend-test-summary.json`, `frontend-test.log`, `frontend-coverage-summary.json`, `frontend-lcov.info`: 309 component tests across 25 files; actual four coverage dimensions retained.
- `cloud-build.log`: actual production frontend build and image build, not a plan.
- `release-guards.log`: 14 Node deployment guards passed.
- `test-requirement-map.json` and `TEST-REQUIREMENT-MATRIX.md`: every one of the 43 Python modules, 30 frontend test files, Redis integration suite and Node guard file maps to requirements and its execution scope. The five mounted frontend files are separate from the 25 component files.
- `mounted-main-workflows.json`: historical published-main integration evidence, clearly separated from the fresh candidate run.

Requirement traceability is 10/10 FR and 10/10 NFR (100% linked), not 100% acceptance. Of 48 acceptance IDs, 46 have passing executable instances (95.83%); TC-22/23 remain manual procedures. All 53 automated catalog instances passed. Current results replace the six stale failure rows in the old report.

Reproduce mapping: `python scripts/build_test_traceability.py --junit docs/testing/evidence/coverage/backend-junit.xml --output docs/testing/evidence/coverage/test-requirement-map.json`. The script rejects an omitted test file. Reproduce coverage in an explicitly opted-in disposable PostgreSQL/PostGIS, Mongo and Redis environment: `python -m coverage run --branch --source=src -m pytest tests -q --junitxml=pytest.xml`, then `python -m coverage xml` and `python -m coverage json`. Frontend: `npm ci`, `npm test -- --coverage`, `npm run build`.
