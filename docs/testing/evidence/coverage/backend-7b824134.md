# Backend coverage — 24 November 2026

**Revision.** [Main 7b824134](https://github.com/akcedia/SmartLoo/tree/7b824134157c64913ec0ca8bdf2b25525992b190). Windows, Python 3.12.10 and Coverage.py 7.10.7. Commands from the repository root.

- `python -m coverage run --branch --source=src -m pytest tests -q --tb=no --junitxml=../main24-tests.xml`
- `python -m coverage json -o ../main24-coverage.json`

| Scope | Executed / measured | Coverage |
| --- | --- | --- |
| Executable statements | 1328 / 1676 | 79.24% |
| Branch destinations | 303 / 436 | 69.50% |
| Combined | 1631 / 2112 | 77.23% |

Coverage includes 17 measured Python modules in `src`, including the merged facility-status and suggestion paths. There are zero excluded source lines. Frontend JavaScript, SQL migrations, scripts, tests and unmerged AI code are outside this Python measurement. The 68 skips limit exercised service-backed paths. Separate service-backed receipts retain their own results.

The combined local measurement is below the 80% target. Record final coverage and lint with service integrations enabled on one fixed release revision. This measurement is independent of SonarQube.
