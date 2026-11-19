# Frontend session, admin analytics and export — test evidence (#58)

Owner: Onur Arda Buldağ ([#58](https://github.com/akcedia/SmartLoo/issues/58), package [#55](https://github.com/akcedia/SmartLoo/issues/55)). Date: 20 November 2026. Input for the [Software Testing Report](../SOFTWARE_TESTING_REPORT.md) (#60). Scope: FR-06, FR-07 export, the FR-08 screens and session client, and the FR-10 account-deletion screen.

This file separates three kinds of evidence. **Automated** covers frontend unit and static-render tests in CI-reproducible form. **Integrated (local)** is a browser and HTTP check against real services on unmerged PR heads. **Not verified** lists what is still open. Nothing here claims that a PR is merged or that a feature is Done.

## 1. Code under test

| PR | Branch @ commit | Content | Base |
|---|---|---|---|
| [#62](https://github.com/akcedia/SmartLoo/pull/62) | `feature/58-session-auth` @ `99338ba` | Shared API client, session store, routes, sign-in/register/account screens, ADMIN-gated live `/admin`, map at `/` | `main` |
| [#63](https://github.com/akcedia/SmartLoo/pull/63) | `feature/58-account-deletion` @ `dc72282` | FR-10 account-deletion screen | #62 |
| [#64](https://github.com/akcedia/SmartLoo/pull/64) | `feature/58-analytics-contract` @ `7a0f32c` | Live panel against contract examples, 366-day limit, export naming | #62 |
| [#65](https://github.com/akcedia/SmartLoo/pull/65) | `feature/58-a11y` @ `edc8e02` | Focus management, contrast tokens, table/chart semantics, 360 px fix | #64 |

## 2. Automated frontend tests

Command: `cd frontend && npm ci && npm test && npm run build`. Windows 11, Node 25.2.1, Vite 5.4.11, Vitest 2.1.8 (the versions on these branches).

| Branch | Passed | Failed | Skipped | Build |
|---|---|---|---|---|
| #62 `99338ba` | 77 | 0 | 0 | passed |
| #63 `dc72282` | 85 | 0 | 0 | passed |
| #64 `7a0f32c` | 102 | 0 | 0 | passed |
| #65 `edc8e02` | 128 | 0 | 0 | passed |

GitHub Actions on #62 (`main` base): frontend, database, nearby search and requirements-baseline jobs passed. #63–#65 target stacked branches, so CI runs once their base becomes `main`. Independent QA re-ran #65 on `edc8e02` with 128 passed and build passed ([#65 comment](https://github.com/akcedia/SmartLoo/pull/65)).

| Test file | What it checks |
|---|---|
| `shared/http/apiClient.test.js` | Bearer header, empty query values dropped, 401 ends the session only when a token was sent, 403 distinct, FastAPI 422 → field errors, network error = status 0, raw download, 204 |
| `shared/session/session.test.js` | JWT claim reading, expiry, `sessionStorage` only (token + email), expired/corrupt/blocked storage |
| `features/auth/auth.test.jsx` | FR-08 field rules, identical message for wrong email/password, no role field on registration, role gate for guest/USER/ADMIN, live admin route without sample data, safe return paths |
| `features/auth/accountDeletion.test.jsx` | `DELETE /users/me` with token, success only for 204, 500/501/network keep the session, explicit confirmation without a password prompt |
| `features/admin/contract.test.jsx` | Contract v0.2 examples: KPI/alert from the API, review-weighted mean (4.2 vs 3.0), strict 3.5, null as "Veri yok", kept facility rows, no-facility state, required-only response, error vs empty, shared summary/export filters, CSV bytes, JSON nulls |
| `features/admin/api/*.test.js` | Istanbul calendar dates, 366-day limit, CSV RFC 4180 and BOM, RFC 5987 filename, export errors never produce a file |
| `app/a11y.test.jsx` | WCAG AA contrast of CSS tokens, focus to page heading and to the first error, labels, disclosure menu, table roles, text table behind the chart, 1 px hidden wrapper |

## 3. Traceability (frontend side)

"Automated" means the frontend unit/static tests in §2. "Integrated" refers to §4. The backend HTTP tests in `tests/test_requirements.py` remain the authoritative TC results and belong to the backend owners.

| TC | FR | Frontend evidence | Automated | Integrated (local) |
|---|---|---|---|---|
| TC-04 | FR-08 | Sign-in stores the JWT and returns to the requested page | Yes | Pass: real login, return to `/admin` |
| TC-09 | FR-06 | Filtered KPI, trend and table from one selection; alert from API | Yes | Pass: Kadıköy 3.857 (7 reviews); after review changes 4.0 → 2.5 → 2.33 with alert |
| TC-10 | FR-07 | CSV download with the on-screen filters | Yes | Pass: BOM, `text/csv; charset=utf-8`, 5 columns, `filename*` with "Kadıköy" |
| TC-24 | FR-07 | JSON download with the same filters | Yes | Pass: only the selected district, null operational fields |
| TC-25 | FR-06 | No reviews → "Veri yok", never 0; facility rows kept | Yes | Pass: before any review and for districts without facilities |
| TC-30 | FR-08 | 409 shown on registration | Yes | Not run in browser |
| TC-34 | FR-10 | Deletion screen succeeds only on 204 | Yes | Backend route still 501; screen reported "not deleted" and kept the session |
| TC-37 | FR-08 | Weak password rejected before submit, server 422 mapped to fields | Yes | Pass: client validation, no request sent |
| TC-40 | FR-08 | One generic message for wrong email and wrong password | Yes | Pass: real 401, same message |
| TC-41 | FR-08 | Missing token → sign-in prompt | Yes | Pass: API 401, sign-in prompt |
| TC-42 | FR-08 | Tampered token ends the session | Yes | Pass: real 401, session cleared, "süresi doldu" notice |
| TC-43 | FR-08 | Token dropped at `exp` | Yes | Not run in browser (60-minute wait) |
| TC-44 | FR-08 | USER cannot open the admin panel | Yes | Pass: API 403, "Yetkiniz yok", no admin request data shown |
| TC-45 | FR-08 | ADMIN opens the panel and exports | Yes | Pass |
| TC-48 | FR-08 | Registration has no role field | Yes | Pass: real registration returned role USER |

## 4. Integrated local check (20 November)

**Build.** A throw-away local branch merged `main` `87994f9`, #67 `8c5d58f` (auth, review reader and review service from Fırat), #71 `7fc1949` (analytics and export from Özgür), #62–#65, and #73 `f61de4f` with the session patch posted on #73. The two analytics routes were bound to #71 in a local `src/app.py` edit, as #71 describes for after #50/#51. None of this glue was pushed.

**Services.** Docker PostGIS 16-3.4 and MongoDB 7.0, migrations 001–004, the `main` facility fixtures, Python 3.13 with the repository's `requirements-test.txt`, Uvicorn, a random JWT secret per run and Vite with the `/api` proxy. Accounts were created through `POST /auth/register`; one was promoted to ADMIN in the local database. All reviews are synthetic.

**Review changes reach the panel and export (acceptance item with QA).**

| Step through the real review API | Summary (Kadıköy) | CSV hygiene_score (F1 / F2) |
|---|---|---|
| No reviews | null, 0, no alert | blank / blank |
| USER 1 rates F1 = 2 | 2.0, 1, **alert** | 2.0 / blank |
| USER 2 rates F2 = 5 | 3.5, 2, no alert (strict) | 2.0 / 5.0 |
| USER 1 edits own review to 4 | 4.5, 2 | 4.0 / 5.0 |
| USER 2 deletes own review | 4.0, 1 | 4.0 / blank |
| USER 2 rates F2 = 1 (browser panel refreshed) | 2.5, 2, **alert** | — |
| USER 1 rates F2 = 2 from the map form (#73 + patch) | 2.33, 3, **alert**; F2 1.50 (kritik) | — |

Review API status codes in the same run: duplicate 409, editing someone else's review 403 (also for ADMIN), guest 401, score 6 → 422, CLOSED facility → 404.

**Other checks.** Istanbul day boundary (23:59:59 included, 00:00 excluded). A district without facilities shows "Tesis yok". Reversed or one-sided dates return 422. MongoDB stopped → 503 → "Veriler alınamadı / Tekrar dene", never "Veri yok"; Retry recovers after restart. The map loads inside the shared shell. No sample data or demo control appears in the live flow.

**Accessibility.** axe-core 4.10.2 (WCAG 2.0/2.1 A and AA) on the live-mode panel: 0 violations. Color-contrast "incomplete" items are SVG axis labels and the `aria-hidden` caret, both `#5b6475` on white = 5.96:1. At 360 px there is no horizontal overflow after the #65 fix. QA independently measured 5.958:1 and confirmed no overflow at 360/768/1920 px.

## 5. Defects found and retest

| Defect | Found in | Owner | Status |
|---|---|---|---|
| Summary without `trend`/`facilities` could crash or show "no facilities" | #64 contract tests | Onur | Fixed in #64; retested |
| Hidden trend table widened the page to 405 px at 360 px | QA on #65 | Onur | Fixed in #65 `68fad68`; QA retest passed |
| JSON export downloaded as `smartloo-hygiene.json` (no `Content-Disposition`) | Integrated check | Onur (frontend fallback) / Özgür (header) | Frontend fixed in #64 `7a0f32c`; backend header open |
| On Windows `localhost` resolves to `::1` first; each DB connection waited ~5 s (login 10.3 s, search 5 s) | Integrated check | Yusuf / Fırat | `127.0.0.1` defaults in #72 for the search reader; `src/db.py` in #67 still defaults to `localhost` |
| Map read a different session key; signed-in users looked like guests | QA on #73 | Furkan (Onur patch) | Verified patch posted on #73; applies after #62 |
| `is_own` is `false` for the review author | QA on #67, re-seen 20 Nov | Fırat | Open in #67 `8c5d58f` |
| 366-day limit not enforced by the server (400 days → 200) | Integrated check | Özgür | Open in #71; panel already blocks it |

## 6. Not verified

- The four PRs are not merged. The integrated check ran on a local merge of open PRs with local route glue, not on `main`.
- Account deletion against a real backend (route returns 501), token expiry after 60 minutes in the browser, and registration 409 in the browser.
- NVDA, Lighthouse, map keyboard alternatives and the 500-marker FPS target (NFR-T05; QA scope in #60).
