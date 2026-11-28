# Main #102 independent retest — 24 November 2026

[Main ca6e93b4](https://github.com/akcedia/SmartLoo/tree/ca6e93b440791773d44785a82d0e7f8fab9a3ad4), after [#102](https://github.com/akcedia/SmartLoo/pull/102). Windows, Node 26.13.1, npm 11.20.0, Python 3.12.10 and Coverage.py 7.10.7. The frontend lockfile matched the previous checkout, and the isolated checkout used the same installed dependencies.

| Check | Outcome |
| --- | --- |
| `npm test -- --reporter=dot` | **302 passed** in 24 files. |
| `npm run build` | **Passed**, 125 modules transformed. |
| Full local Python suite | **231 passed, 7 failed, 68 skipped**. Seven passing subtests were reported separately. |
| Requirements catalog subset | **45 passed, 7 failed, 0 skipped**. TC-08, both TC-15 variants, TC-16, TC-17, legacy TC-21 and TC-28 remained red. |
| Python coverage | 1328/1676 statements (79.24%), 303/436 branch destinations (69.50%), **1631/2112 combined (77.23%)**. |

Commands from the repository root for Python:

```sh
python -m coverage run --branch --source=src -m pytest tests -q --tb=no --junitxml=../final-main24-tests.xml
python -m coverage json -o ../final-main24-coverage.json
```

Coverage measures `src` without excluded source lines. JavaScript, SQL, tests and unmerged AI are outside this measurement. The 68 skipped service-dependent cases limit the coverage. The 80% target remains open.

#102 added the authenticated facility suggestion screen and covered its submission contract in frontend tests. The [contributor's verified scenario](../../USER-SUGGESTION-REVIEW-2026-11-24.md) uses private PostGIS and MongoDB to check a pending suggestion stays unpublished until approval. It is separate from this local retest. The updated app was not deployed or tested against public data. The [independent AI candidate checks](ai-33fee172.md) keep their separate source revision.
