# Requirements, analysis models and test traceability

Original contribution: Yusuf Selim Aksu — [PR #18](https://github.com/akcedia/SmartLoo/pull/18), commit `2a2787ae02d44d06b175c00edb6d7b61f2c22f6f`.
Integration corrections: Özgür Kılıç, 16 October 2026. Original FR definitions and TC ranges were corrected against [requirements](../REQUIREMENTS.MD) and the [48-case catalog](../../tests/requirements_cases.json). This does not imply Yusuf has approved these changes.

| FR | Canonical capability | Primary model | Existing acceptance tests | Status |
|---|---|---|---|---|
| FR-01 | Nearby open facilities | [Model](behavior/map-search.md) | TC-01, TC-11, TC-14 | Documented; owner/TA review pending |
| FR-02 | Accessibility, baby-changing and price filters | [Model](behavior/map-search.md) | TC-02, TC-03, TC-12, TC-13 | Documented; owner/TA review pending |
| FR-03 | Create, edit and delete reviews | [Model](behavior/reviews.md) | TC-05, TC-06, TC-26, TC-31, TC-32, TC-35, TC-46 | Documented; owner/TA review pending |
| FR-04 | AI summaries and preference recommendations | [Model](SmartLoo_FR04_FR07_Analiz.md) | TC-08, TC-15, TC-16, TC-17, TC-28 | Documented; owner/TA review pending |
| FR-05 | Suggest and moderate facilities | [Model](behavior/suggestions.md) | TC-07, TC-18 | Documented; owner/TA review pending |
| FR-06 | District/date hygiene analytics | [Model](behavior/dashboard-import-export.md) | TC-09, TC-25 | Documented; owner/TA review pending |
| FR-07 | CSV/JSON import and report export | [Model](behavior/dashboard-import-export.md) | TC-10, TC-19, TC-20, TC-24, TC-36 | Documented; owner/TA review pending |
| FR-08 | Registration, login and roles | [Model](behavior/auth-account.md) | TC-04, TC-30, TC-37, TC-38, TC-39, TC-40, TC-41, TC-42, TC-43, TC-44, TC-45, TC-47, TC-48 | Documented; owner/TA review pending |
| FR-09 | Map and facility details | [Model](behavior/map-search.md) | TC-21, TC-22, TC-23 | Documented; owner/TA review pending |
| FR-10 | Integrity, account deletion and closure | [Model](behavior/auth-account.md) | TC-27, TC-29, TC-33, TC-34 | Documented; owner/TA review pending |

FR-10 also uses [facility closure/moderation](behavior/suggestions.md) and [logical E-R](data/er-data-dictionary.md). Auth and data integrity apply across the other models. FR-04 uses both summary and recommendation DFDs. FR-07 also uses Emir's external-source mapping.

## Consistency findings

- All FR-01–FR-10 meanings and TC-01–TC-48 assignments now match the catalog; no arbitrary ranges stand in for actual coverage.
- Nullable metadata remains unknown, never false; no-review average remains null. Canonical names are `Suggestion`, `has_disabled_access`, `has_baby_changing`, `average_cleanliness`.
- AI belongs to FR-04 and returns HTTP 200 with null summary and actual statistics on fallback by 10 seconds. It must not block search.
- Existing test mappings specify expectations, not passing application behavior. TC-21 checks only the HTML shell; TC-22/23 are manual. No application tests were rerun for this documentation change.
- Retained review text requires personal-data removal/redaction. Cross-store retries require durable affected IDs; simply repeating a user-ID query after anonymization is insufficient.
- Source identity is a proposal; contributor profiling evidence is absent from PR #22. Duplicate suggestions, physical source duplicates and account flag semantics remain open in the main report.

## Verification limits

NFR performance, usability, privacy and security targets remain those in REQUIREMENTS.MD §4. Diagram readability checks do not prove production performance, privacy compliance or working UI. Untested variants include source fingerprint collisions, redaction/cache races, upper AI evidence limits and manual viewport browsing; these remain implementation verification tasks rather than fabricated passing tests.
