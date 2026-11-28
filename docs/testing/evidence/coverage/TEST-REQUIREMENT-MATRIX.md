# Complete test-file and requirement matrix

Generated from the executed JUnit and explicit reviewed test-file mapping. A linked file counts as traced; it does not imply that every acceptance threshold passed.

| Test file | Requirements | Execution/evidence scope |
|---|---|---|
| `tests/test_account_deletion.py` | FR-10, NFR-03, NFR-08 | passed; 8 JUnit cases; `backend-junit.xml` |
| `tests/test_account_deletion_integration.py` | FR-10, NFR-03, NFR-08 | passed; 6 JUnit cases; `backend-junit.xml` |
| `tests/test_admin_analytics.py` | FR-06, FR-07, NFR-03, NFR-04 | passed; 22 JUnit cases; `backend-junit.xml` |
| `tests/test_admin_analytics_integration.py` | FR-06, FR-07, NFR-03, NFR-04 | passed; 12 JUnit cases; `backend-junit.xml` |
| `tests/test_admin_import.py` | FR-07, NFR-03, NFR-04 | passed; 26 JUnit cases; `backend-junit.xml` |
| `tests/test_admin_import_postgres.py` | FR-07, NFR-03, NFR-04 | passed; 9 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_boundaries.py` | FR-04, NFR-02, NFR-08 | passed; 18 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_consistency_contract.py` | FR-03, FR-04, FR-10, NFR-08 | passed; 15 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_guarded_publication.py` | FR-03, FR-04, NFR-08 | passed; 14 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_openai.py` | FR-04, NFR-02, NFR-08 | passed; 18 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_recommendations.py` | FR-02, FR-04, NFR-02 | passed; 16 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_restricted_policy.py` | FR-04, NFR-08 | passed; 16 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_review_adapter.py` | FR-03, FR-04, NFR-08 | passed; 12 JUnit cases; `backend-junit.xml` |
| `tests/test_ai_summary_service.py` | FR-04, NFR-02, NFR-07, NFR-08 | passed; 18 JUnit cases; `backend-junit.xml` |
| `tests/test_auth_password_bytes.py` | FR-08, NFR-03, NFR-04 | passed; 8 JUnit cases; `backend-junit.xml` |
| `tests/test_auth_postgres.py` | FR-08, NFR-03 | passed; 10 JUnit cases; `backend-junit.xml` |
| `tests/test_auth_timing_dummy.py` | FR-08, NFR-03, NFR-04 | passed; 3 JUnit cases; `backend-junit.xml` |
| `tests/test_cloud_app.py` | FR-09, NFR-04, NFR-07 | passed; 15 JUnit cases; `backend-junit.xml` |
| `tests/test_facility_admin.py` | FR-05, FR-10, NFR-03 | passed; 5 JUnit cases; `backend-junit.xml` |
| `tests/test_gemini_http_acceptance.py` | FR-04, NFR-02, NFR-08 | passed; 4 JUnit cases; `backend-junit.xml` |
| `tests/test_gemini_provider.py` | FR-04, NFR-02, NFR-08 | passed; 21 JUnit cases; `backend-junit.xml` |
| `tests/test_gemini_recommendation_followup.py` | FR-04, NFR-02, NFR-08 | passed; 5 JUnit cases; `backend-junit.xml` |
| `tests/test_ibb_geojson.py` | FR-07, NFR-04 | passed; 20 JUnit cases; `backend-junit.xml` |
| `tests/test_ibb_import.py` | FR-07, NFR-04 | passed; 11 JUnit cases; `backend-junit.xml` |
| `tests/test_ibb_import_postgres.py` | FR-07, NFR-04 | passed; 7 JUnit cases; `backend-junit.xml` |
| `tests/test_local_runtime.py` | NFR-09 | passed; 4 JUnit cases; `backend-junit.xml` |
| `tests/test_nearby_pool.py` | FR-01, NFR-01, NFR-07 | passed; 7 JUnit cases; `backend-junit.xml` |
| `tests/test_nearby_postgis.py` | FR-01, FR-02, NFR-01, NFR-04 | passed; 5 JUnit cases; `backend-junit.xml` |
| `tests/test_nearby_response.py` | FR-01, FR-02, NFR-01, NFR-04 | passed; 1 JUnit cases; `backend-junit.xml` |
| `tests/test_nearby_safety.py` | FR-01, FR-02, NFR-04 | passed; 29 JUnit cases; `backend-junit.xml` |
| `tests/test_recommendation_http.py` | FR-02, FR-04, NFR-02, NFR-04 | passed; 17 JUnit cases; `backend-junit.xml` |
| `tests/test_recommendation_wiring.py` | FR-01, FR-04, NFR-07 | passed; 10 JUnit cases; `backend-junit.xml` |
| `tests/test_requirements.py` | FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, NFR-03, NFR-04, NFR-08 | passed; 53 JUnit cases; `backend-junit.xml` |
| `tests/test_review_consistency.py` | FR-03, FR-04, FR-10, NFR-08 | passed; 5 JUnit cases; `backend-junit.xml` |
| `tests/test_review_publication.py` | FR-03, FR-04, NFR-08 | passed; 5 JUnit cases; `backend-junit.xml` |
| `tests/test_review_scores_mongo.py` | FR-03, FR-06, FR-07, NFR-08 | passed; 6 JUnit cases; `backend-junit.xml` |
| `tests/test_reviews.py` | FR-03, NFR-03, NFR-04, NFR-08 | passed; 18 JUnit cases; `backend-junit.xml` |
| `tests/test_reviews_integration.py` | FR-03, FR-10, NFR-03, NFR-08 | passed; 7 JUnit cases; `backend-junit.xml` |
| `tests/test_suggestions.py` | FR-05, FR-10, NFR-03, NFR-04 | passed; 9 JUnit cases; `backend-junit.xml` |
| `tests/test_summary_http.py` | FR-03, FR-04, NFR-02, NFR-08 | passed; 14 JUnit cases; `backend-junit.xml` |
| `tests/test_toilet_detail.py` | FR-01, FR-09, NFR-04 | passed; 6 JUnit cases; `backend-junit.xml` |
| `tests/test_turkish_ai_acceptance.py` | FR-04, NFR-08 | passed; 42 JUnit cases; `backend-junit.xml` |
| `tests/test_zap_regressions.py` | FR-08, FR-09, NFR-04 | passed; 15 JUnit cases; `backend-junit.xml` |
| `frontend/src/app/a11y.test.jsx` | FR-09, NFR-05, NFR-06 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/admin.live.jsx` | FR-06, FR-07, NFR-03, NFR-08 | mounted integration scope; `mounted-main-workflows.json` |
| `frontend/src/features/admin/api/admin.test.js` | FR-06, FR-07, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/api/httpAdapter.test.js` | FR-06, FR-07, FR-08, NFR-03 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/components/components.test.jsx` | FR-06, FR-07, NFR-05, NFR-06 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/contract.test.jsx` | FR-06, FR-07, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/import/AdminImport.test.jsx` | FR-07, NFR-03, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/import/adminImport.live.jsx` | FR-07, NFR-03, NFR-04 | mounted integration scope; `mounted-main-workflows.json` |
| `frontend/src/features/admin/import/importApi.test.js` | FR-07, NFR-03, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/moderation/moderation.live.jsx` | FR-05, FR-10, NFR-03, NFR-08 | mounted integration scope; `mounted-main-workflows.json` |
| `frontend/src/features/admin/moderation/moderation.test.jsx` | FR-05, FR-10, NFR-03, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/admin/moderation/moderationRace.test.jsx` | FR-05, FR-10, NFR-03, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/auth/accountDeletion.live.jsx` | FR-10, NFR-03, NFR-08 | mounted integration scope; `mounted-main-workflows.json` |
| `frontend/src/features/auth/accountDeletion.test.jsx` | FR-10, NFR-03, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/auth/auth.test.jsx` | FR-08, NFR-03, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/MapView.density.test.jsx` | FR-09, NFR-05 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/ai.live.jsx` | FR-04, NFR-02, NFR-08 | mounted integration scope; `mounted-main-workflows.json` |
| `frontend/src/features/map/cityDirectory.test.jsx` | FR-01, FR-02, FR-07, FR-09, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/directions.test.jsx` | FR-09, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/layout.test.jsx` | FR-02, FR-09, NFR-05, NFR-06 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/map.test.jsx` | FR-03, FR-04, FR-09, NFR-04, NFR-06 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/markerDensity.test.js` | FR-09, NFR-05 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/recommendationPanel.test.jsx` | FR-02, FR-04, NFR-10 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/map/reviewSession.test.jsx` | FR-03, FR-08, NFR-03, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/features/suggestions/suggestion.test.jsx` | FR-05, FR-08, NFR-03, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/shared/http/apiClient.test.js` | FR-08, NFR-03, NFR-04 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/shared/i18n/i18n.test.jsx` | NFR-10 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/shared/session/session.test.js` | FR-08, FR-10, NFR-03, NFR-08 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/shared/settings/settings.test.jsx` | FR-09, NFR-05, NFR-06, NFR-10 | frontend component scope; `frontend-test-summary.json` |
| `frontend/src/shared/theme/theme.test.jsx` | NFR-05, NFR-06 | frontend component scope; `frontend-test-summary.json` |
| `tests/release_checks.test.cjs` | NFR-09 | Node deployment guards; `release-guards.log` |
| `integration/ai_redis_suite.py` | FR-04, NFR-02, NFR-07 | real Redis component scope; `mounted-main-workflows.json` |

## Acceptance catalog: all 48 IDs

| Case | Requirement | Scenario | Final result |
|---|---|---|---|
| TC-01 | FR-01 | Nearby open toilets | Automated passing instance(s) |
| TC-02 | FR-02 | Accessibility filter | Automated passing instance(s) |
| TC-03 | FR-02 | Baby changing filter | Automated passing instance(s) |
| TC-04 | FR-08 | Successful login | Automated passing instance(s) |
| TC-05 | FR-03 | Reject guest review | Automated passing instance(s) |
| TC-06 | FR-03 | Create review and aggregate | Automated passing instance(s) |
| TC-07 | FR-05 | Suggest location | Automated passing instance(s) |
| TC-08 | FR-04 | Structured Turkish AI summary | Automated passing instance(s) |
| TC-09 | FR-06 | Filtered dashboard | Automated passing instance(s) |
| TC-10 | FR-07 | CSV report export | Automated passing instance(s) |
| TC-11 | FR-01 | Reject invalid search | Automated passing instance(s) |
| TC-12 | FR-02 | Combined filters and clearing | Automated passing instance(s) |
| TC-13 | FR-02 | Pricing filter | Automated passing instance(s) |
| TC-14 | FR-01 | Empty nearby results | Automated passing instance(s) |
| TC-15 | FR-04 | AI outage and insufficient reviews | Automated passing instance(s) |
| TC-16 | FR-04 | Summary cache | Automated passing instance(s) |
| TC-17 | FR-04 | Preference recommendations | Automated passing instance(s) |
| TC-18 | FR-05 | Moderate suggestions | Automated passing instance(s) |
| TC-19 | FR-07 | Idempotent CSV and JSON import | Automated passing instance(s) |
| TC-20 | FR-07 | Invalid import is atomic | Automated passing instance(s) |
| TC-21 | FR-09 | Built SPA shell and separate rendered map acceptance | Automated passing instance(s) |
| TC-22 | FR-09 | Map without geolocation | Manual; see requirements 5.1 and scoped browser evidence |
| TC-23 | FR-09 | Filter markers remain consistent | Manual; see requirements 5.1 and scoped browser evidence |
| TC-24 | FR-07 | JSON report export | Automated passing instance(s) |
| TC-25 | FR-06 | Dashboard has no data | Automated passing instance(s) |
| TC-26 | FR-03 | Edit and delete own review | Automated passing instance(s) |
| TC-27 | FR-10 | Close reviewed facility | Automated passing instance(s) |
| TC-28 | FR-04 | Untrusted review content | Automated passing instance(s) |
| TC-29 | FR-10 | Invalid toilet coordinates | Automated passing instance(s) |
| TC-30 | FR-08 | Case insensitive email | Automated passing instance(s) |
| TC-31 | FR-03 | Invalid review rating | Automated passing instance(s) |
| TC-32 | FR-03 | Duplicate review | Automated passing instance(s) |
| TC-33 | FR-10 | Nonexistent toilet | Automated passing instance(s) |
| TC-34 | FR-10 | Account deletion | Automated passing instance(s) |
| TC-35 | FR-03 | Recalculate aggregate | Automated passing instance(s) |
| TC-36 | FR-07 | Stable source identity | Automated passing instance(s) |
| TC-37 | FR-08 | Weak password | Automated passing instance(s) |
| TC-38 | FR-08 | Password storage and response | Automated passing instance(s) |
| TC-39 | FR-08 | JWT claims | Automated passing instance(s) |
| TC-40 | FR-08 | Generic login error | Automated passing instance(s) |
| TC-41 | FR-08 | Missing token | Automated passing instance(s) |
| TC-42 | FR-08 | Tampered token | Automated passing instance(s) |
| TC-43 | FR-08 | Expired token | Automated passing instance(s) |
| TC-44 | FR-08 | User cannot access admin | Automated passing instance(s) |
| TC-45 | FR-08 | Admin access | Automated passing instance(s) |
| TC-46 | FR-03 | Review ownership | Automated passing instance(s) |
| TC-47 | FR-08 | Login throttling | Automated passing instance(s) |
| TC-48 | FR-08 | Public registration cannot grant administrator privileges | Automated passing instance(s) |
