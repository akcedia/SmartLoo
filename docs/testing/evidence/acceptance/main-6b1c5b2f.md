# Acceptance and regression results on 6b1c5b2f

Tested commit: `6b1c5b2f8dc30988edd6107e0f9c2c8b3a999e5c`, Windows, Python 3.12.10. Run: all local pytest tests under coverage.py 7.10.7 with branch coverage. Exit 1 due to the explicit acceptance failures.

| Scope | Passed | Failed | Skipped | Total |
| --- | --- | --- | --- | --- |
| Automated acceptance catalog | 42 | 10 | 0 | 52 |
| Other collected pytest cases | 158 | 0 | 66 | 224 |
| All collected pytest cases | 200 | 10 | 66 | 276 |

Seven additional subtests passed and are not added to the 276 pytest items. TC-22 and TC-23 are manual scenarios and excluded from the 52 automated instances. Their historical evidence remains in the report.

The 10 failing instances cover nine case IDs. TC-07/18 and TC-27 remain open for suggested facilities, moderation and facility closure. TC-08/15/16/17/28 are six AI instances, including both TC-15 variants. TC-21 still targets the backend root/initial HTML; separate frontend hosting and current browser verification need their own evidence. TC-06/26/35 passed after #79 isolated the test data. TC-19 (both formats), TC-20, TC-29 and TC-36 passed after #80. TC-34 stayed green.

The latest candidate CI for #80 is separate from this local run. [#80 required CI](https://github.com/akcedia/SmartLoo/actions/runs/44885901930) records real-service workflows. [#79 and handoff](https://github.com/akcedia/SmartLoo/issues/60#issuecomment-7059811141) reported 37/15 without skips and 9 targeted PostGIS/detail passes on 85031d2. [21 November historical QA](../../QA-2026-11-21.md) records 34/18 for the catalog and 99/18 in its selected backend run at fde33e2b.

| Case ID | Passed instances | Failed instances | Skipped instances |
| --- | --- | --- | --- |
| TC-01 | 1 | 0 | 0 |
| TC-02 | 1 | 0 | 0 |
| TC-03 | 1 | 0 | 0 |
| TC-04 | 1 | 0 | 0 |
| TC-05 | 1 | 0 | 0 |
| TC-06 | 1 | 0 | 0 |
| TC-07 | 0 | 1 | 0 |
| TC-08 | 0 | 1 | 0 |
| TC-09 | 1 | 0 | 0 |
| TC-10 | 1 | 0 | 0 |
| TC-11 | 4 | 0 | 0 |
| TC-12 | 1 | 0 | 0 |
| TC-13 | 1 | 0 | 0 |
| TC-14 | 1 | 0 | 0 |
| TC-15 | 0 | 2 | 0 |
| TC-16 | 0 | 1 | 0 |
| TC-17 | 0 | 1 | 0 |
| TC-18 | 0 | 1 | 0 |
| TC-19 | 2 | 0 | 0 |
| TC-20 | 1 | 0 | 0 |
| TC-21 | 0 | 1 | 0 |
| TC-24 | 1 | 0 | 0 |
| TC-25 | 1 | 0 | 0 |
| TC-26 | 1 | 0 | 0 |
| TC-27 | 0 | 1 | 0 |
| TC-28 | 0 | 1 | 0 |
| TC-29 | 1 | 0 | 0 |
| TC-30 | 1 | 0 | 0 |
| TC-31 | 2 | 0 | 0 |
| TC-32 | 1 | 0 | 0 |
| TC-33 | 1 | 0 | 0 |
| TC-34 | 1 | 0 | 0 |
| TC-35 | 1 | 0 | 0 |
| TC-36 | 1 | 0 | 0 |
| TC-37 | 1 | 0 | 0 |
| TC-38 | 1 | 0 | 0 |
| TC-39 | 1 | 0 | 0 |
| TC-40 | 1 | 0 | 0 |
| TC-41 | 1 | 0 | 0 |
| TC-42 | 1 | 0 | 0 |
| TC-43 | 1 | 0 | 0 |
| TC-44 | 1 | 0 | 0 |
| TC-45 | 1 | 0 | 0 |
| TC-46 | 1 | 0 | 0 |
| TC-47 | 1 | 0 | 0 |
| TC-48 | 1 | 0 | 0 |

## Local skips by suite

- test_account_deletion_integration: 6
- test_admin_analytics_integration: 12
- test_admin_import_postgres: 9
- test_auth_postgres: 10
- test_ibb_import_postgres: 7
- test_nearby_postgis: 5
- test_review_scores_mongo: 6
- test_reviews_integration: 7
- test_toilet_detail: 4
