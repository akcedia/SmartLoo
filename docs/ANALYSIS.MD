# SmartLoo - Requirement Analysis Report

**Version:** 0.1 initial review draft, 14 October 2026  
**Integration owner:** Özgür Kılıç  
**Baseline:** [Requirements Definition Report](REQUIREMENTS.MD)  
**PR deadline:** 14 October 2026  
**Final PDF deadline:** 18 October 2026, 23:59

## 1. Purpose and submission status

This report analyzes the existing SmartLoo requirements through domain, logical data and behavioral models. It introduces no additional product scope. This initial draft is intended for the 14 October review PR; it is not a completed analysis submission. Remaining team contributions and consistency corrections are planned for Friday, 16 October, following the instructor's allowance reported by the team contact. Final PDF submission remains contingent on review approval and the 18 October deadline.

| Work | Owner / issue | Current status |
|---|---|---|
| Domain model and context | Özgür, #12 | Initial draft prepared; team review pending |
| Review and suggestion/moderation flows | Özgür, #12 | Initial drafts prepared |
| E-R, data dictionary and auth/account flows | Fırat, #13 | Owner contribution pending; provisional E-R included |
| Source mapping and AI flow | Emir, #14 | Contribution pending |
| Dashboard and import/export flows | Onur, #15 | Contribution pending |
| Location, filters and map flow | Furkan, #16 | Contribution pending |
| Traceability and consistency review | Yusuf, #17 / PR #18 | Updated proposal received; FR/test mapping corrections still pending |

No missing models are represented as complete or validated. Existing red-stage tests specify expected behavior; they do not demonstrate implemented feature correctness.

## 2. Data models

[Domain and preliminary E-R models](analysis/data/domain-and-er.md) define User, Toilet, Review, Suggestion and a derived AISummary concept. Role is an account property. Logical optional author relationships preserve anonymous retained reviews after account deletion. Unknown facility values remain explicit. Fırat must review/refine the E-R, data dictionary and SQL/NoSQL relationship interpretation.

## 3. Behavioral models

| Model | Format | Coverage / status |
|---|---|---|
| [System context](analysis/behavior/context.md) | Context DFD | Boundary for FR-01–FR-10; initial |
| [Review lifecycle](analysis/behavior/reviews.md) | Business process | FR-03 plus auth, integrity and cache effects; initial |
| [Suggestion/moderation](analysis/behavior/suggestions.md) | Business process | FR-05 plus auth/integrity; initial |
| Location, filters and map | DFD, planned | FR-01, FR-02, FR-09; pending Furkan |
| Authentication and account deletion | Behavioral model, planned | FR-08, FR-10; pending Fırat |
| AI summaries and recommendations | DFD, planned | FR-04; pending Emir |
| Dashboard and import/export | DFD, planned | FR-06, FR-07; pending Onur, with source mapping from Emir |

Context-level coverage does not replace detailed use-case models. The final report must cover meaningful execution flows, including important failure/empty cases, before calling analysis complete.

## 4. Canonical requirement/model/test mapping

This integration table uses the existing report's FR and TC IDs. Pending model rows are planned coverage, not verified coverage.

| FR | Capability | Model / owner | Existing acceptance tests | Status |
|---|---|---|---|---|
| FR-01 | Nearby open facilities | Map/search DFD, Furkan | TC-01, TC-11, TC-14 | Pending |
| FR-02 | Accessibility, baby-changing and price filters | Map/search DFD, Furkan | TC-02, TC-03, TC-12, TC-13 | Pending |
| FR-03 | Create/edit/delete reviews | Review lifecycle, Özgür; E-R, Fırat | TC-05, TC-06, TC-26, TC-31, TC-32, TC-35, TC-46 | Initial model |
| FR-04 | AI summary and recommendations | AI flow, Emir | TC-08, TC-15, TC-16, TC-17, TC-28 | Pending |
| FR-05 | Suggest and moderate facilities | Suggestion/moderation, Özgür | TC-07, TC-18 | Initial model |
| FR-06 | District/date analytics | Dashboard DFD, Onur | TC-09, TC-25 | Pending |
| FR-07 | Import and export | Import/export DFD, Onur/Emir | TC-10, TC-19, TC-20, TC-24, TC-36 | Pending |
| FR-08 | Auth and roles | Auth model, Fırat | TC-04, TC-30, TC-37–TC-45, TC-47, TC-48 | Pending |
| FR-09 | Map and details | Map DFD, Furkan | TC-21–TC-23 | Pending; TC-22/23 manual |
| FR-10 | Integrity and personal-data deletion | E-R/account model, Fırat | TC-29, TC-33, TC-34, TC-27 | Preliminary E-R only |

## 5. Consistency findings to resolve

Yusuf's [PR #18](https://github.com/akcedia/SmartLoo/pull/18) provides a QA proposal, not yet integrated. Its 14 October update corrects unknown/null values, selected field names, the ten-second timeout and pending model status. FR definitions and TC mapping still require correction before integration:

- FR-03 is review management, not baby-changing filtering. Auth is FR-08, AI is FR-04, dashboard is FR-06 and import/export is FR-07. All ten rows must use the canonical mapping above.
- Canonical properties include `has_disabled_access`, `has_baby_changing`, `average_cleanliness` and `Suggestion`. Alternate names must not silently replace the baseline.
- Resolved in the latest QA proposal: missing metadata remains null/unknown, not false. Preserve that rule throughout the submitted models.
- Resolved duration: timeout fallback by 10 seconds. The QA proposal must still map this rule to FR-04 rather than FR-08, and describe HTTP 200 with null summary and available review statistics, with a clear UI explanation.
- The functional catalog contains TC-01–TC-48, not only TC-01–TC-10. Match relevant cases without claiming they passed implementation tests.
- Resolved status labels: the updated QA table says review pending. Verify actual submitted model files before labelling them consistent.
- Account deletion must remove/redact personal data in retained free text as needed; nulling the author reference alone is insufficient.

This finding list records integration review by Özgür; it distinguishes Yusuf's submitted corrections from remaining integration findings. His PR and issue are not modified or closed by this draft.

## 6. Open decisions and remaining work

1. Reconcile the preliminary domain/E-R with Fırat's model, including suggestion retention, authorship and moderator metadata on account deletion.
2. Validate source identity, field meanings and optional historical-usage joins with Emir. Usage counts are not hygiene ratings.
3. Add remaining use-case models and exact references, including AI fallback, map permission denial, empty analytics, invalid/atomic imports and account deletion.
4. Agree how repeated moderation decisions and duplicate suggested places behave, without silently changing requirements.
5. Yusuf checks the completed models against FR/TC references and non-functional constraints; capture unresolved findings honestly.
6. Furkan and Onur begin frontend mockups. The announcement explicitly allows delivery later; mockups are not a missing mandatory attachment for this analysis PR.
7. Resolve review comments, obtain approval and export the report to PDF with diagram images embedded. Other artifacts may be linked as permitted by the analysis announcement.

## 7. Friday integration target

The reported extension allows updates through Friday, 16 October, but does not replace the requirement to open the review PR on 14 October. Team contributions should arrive early enough for reconciliation and review. The final PDF is due 18 October 23:59. This document has not been uploaded, submitted, approved or merged merely by preparing it locally.
