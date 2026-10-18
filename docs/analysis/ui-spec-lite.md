# Application

Name: SmartLoo

Description:
A responsive web application for discovering Istanbul public toilets, reading community hygiene feedback, receiving grounded AI summaries/recommendations and administering facility data.

Actors:
- Guest
- Registered user (USER)
- Administrator (ADMIN; also has registered-user browsing and self-account actions)

Style:
- Responsive Web
- Light Theme
- Consistent labelled controls and readable contrast
- Map-first discovery, clear unknown/error/loading states
- Desktop panels collapse or stack on narrow screens

This specification follows the instructor-provided **UI Spec Lite (Educational Standard)** guide uploaded this week. The guide's original reference is `UI_Spec_Lite_Guide (1).docx`; it is a supplied course document, not a repository file. Its workflow starts from functional requirements, creates this Markdown specification, uses it as input to an AI-assisted mockup tool (Figma is an example), then visually refines the mockup before implementation/export. Here the review artifacts are editable SVG mockups refined from the same baseline; no Figma export or automated tool conversion is claimed.

Baseline: [requirements](../REQUIREMENTS.MD), [data/security requirements](../requirements/db-security.md). Integration author: Özgür Kılıç, issue #12; source responsibilities are credited in [ANALYSIS.MD](../ANALYSIS.MD). UI controls and layouts are analysis proposals; functional behavior remains the canonical baseline.

Four mockup plates group eight screen specifications and their important states. A plate is not a claim that all alternatives appear simultaneously. Example names, metrics and map positions are illustrative. No executable application or browser test is delivered by these mockups.

---

# Screen: Discovery Map

## Purpose

Find facilities using location, radius and known amenity information; browse manually when location permission is denied.

Requirements: FR-01, FR-02, FR-09. Actors: Guest, registered user and administrator.

## Layout

Master Detail; Two Columns on desktop. Left: search controls and result list. Center: map. Right or overlay: selected facility details. On narrow screens use a full-width map with collapsible controls and details.

## Components

- Header: SmartLoo, Sign in or Account, Suggest facility; ADMIN additionally sees Dashboard.
- Toolbar: location Button, radius Textbox (1–50000 m, default 1000), open-now Checkbox.
- Dropdown: accessibility, baby changing and price. Each has Any / Yes / No (price Any / Free / Paid). Any omits the filter.
- Label: active filters, location permission state, result count, loading/error/empty result.
- Panel: Leaflet map with zoom controls, search-radius circle and selectable facility markers.
- Card or Table: result name, known status and actual user distance only when user location is available.

## Actions

- Request browser location; apply/clear amenity filters; change radius and open-now selection.
- Pan/zoom to browse; select a result/marker; retry a failed request.
- Clearing amenities keeps the current search radius and open-now setting.

## Navigation

Application entry point. Marker/result selection opens Facility Details within the map. Sign in opens Sign In; Suggest facility opens Suggest Facility for authenticated users, otherwise Sign In. Account opens Account Privacy; ADMIN Dashboard opens Administration.

## User Flow

1. Open map and ask for location permission.
2. With permission, use the user coordinates; with denial, retain a usable map and explain that user distances are unavailable.
3. Send validated search origin, radius and filters to the existing nearby endpoint.
4. Display only returned results as markers; adjust map bounds to the search circle.
5. On filter or view change refresh the query, visible results and active filter labels together.

## Notes

Permission-denial proposal: use the viewport center as the explicit query origin for the existing required lat/lon contract. The center is never claimed as the user location. Hide user-distance labels when userLocation is absent. Initial browsing center and viewport-radius mapping require UI design review. Unknown values match neither true nor false filters; open-only excludes unknown hours. Empty matches offer radius/filter adjustment. Cancel or ignore obsolete responses so old requests cannot replace current filters. This is a design obligation, not implemented behavior.

[Associated editable SVG mockup](assets/ui-map.svg).

---

# Screen: Facility Details

## Purpose

Inspect selected facility metadata, public reviews and an explicitly labelled AI summary; request suitable facilities using current preferences.

Requirements: FR-03, FR-04, FR-09. Actors: Guest, registered user and administrator.

## Layout

Master Detail; Panel beside the discovery map on desktop, full-width sheet on narrow screens.

## Components

- Header: facility name and close Button.
- Label: geographic distance when user location exists; accessibility, baby changing, pricing, hours and administrative status.
- Card: actual cleanliness mean and review count; no reviews means “Henüz puan yok”, count 0.
- Section: public review list with author or Anonymous, score and optional comment.
- Card: AI-generated summary label, summary, pros/cons, recommendation, based_on_reviews and generated_at.
- Button: Write/Edit my review; Report missing facility returns to Suggest Facility.
- Section: current preference controls and request Button; at most three recommendation Cards with supported reasons when AI is available.

## Actions

- Select another marker to replace details; close details to return to the unchanged map.
- Read reviews; open Review Editor for the authenticated author.
- Request recommendations with current preferences after signing in; select a recommended facility.

## Navigation

Opened from Discovery Map. Review actions open Review Editor; guests go to Sign In first. Closing returns focus to the map selection control. Recommendations link to another Facility Details panel.

## User Flow

1. Select marker and load its matching details/public reviews.
2. Render facility information without waiting for the separate summary request.
3. Show summary loading, then a validated labelled summary or explicit fallback.
4. For recommendations, authorize the user, apply hard preferences and display at most three matching facilities.

## Notes

Unknown metadata displays “Bilinmiyor”; no invented fee, opening time or safety guarantee. A nonexistent ID shows not found. Fewer than three eligible reviews: summary=null and canonical message “Not enough reviews to generate a summary (minimum 3).” Provider/validation failure returns fallback by 10 seconds; UI message “Summary temporarily unavailable.” Actual review statistics remain. AI-unavailable recommendations keep eligible facilities without an AI reason. Summary content is Turkish; exact UI localization is a design choice.

[Associated editable SVG mockup](assets/ui-map.svg).

---

# Screen: Sign In

## Purpose

Authenticate an existing account for protected contributions and account access.

Requirements: FR-08. Actors: Guest.

## Layout

Single Column; centered form, map navigation still available.

## Components

- Header: SmartLoo and Back to map.
- Textbox: email and masked password, each with a persistent label.
- Button: Sign in.
- Label: generic authentication error, validation feedback and rate-limit feedback.
- Button or link: Create account.

## Actions

- Enter credentials and submit; open Register; return to the map.

## Navigation

From map, protected contribution action or an expired session. Success returns to the requested permitted screen; ADMIN dashboard access still requires role authorization.

## User Flow

1. Enter email and password.
2. Submit and show loading feedback.
3. On success hold the signed access token according to later security design and resume the permitted action.
4. On failure show the generic error; on throttling show retry guidance without claiming the account exists.

## Notes

Wrong email and wrong password share “Invalid email or password” (401). Tokens last 60 minutes. After five failed attempts for an email within fifteen minutes, subsequent attempts receive 429 until expiry. No refresh token, social login or email password reset is added. Token storage is a security-design decision; no insecure browser storage is prescribed.

[Associated editable SVG mockup](assets/ui-account.svg).

---

# Screen: Register

## Purpose

Create a USER account with valid credentials.

Requirements: FR-08. Actors: Guest.

## Layout

Single Column; labelled registration form.

## Components

- Textbox: display name (3–30 characters), email and masked password.
- Label: password policy (at least 8 characters, one letter and one digit).
- Button: Create account; link to Sign In.
- Label: field validation and duplicate-email feedback.

## Actions

- Enter registration details; submit; correct invalid fields; return to Sign In or map.

## Navigation

From Sign In. Successful registration leads to Sign In; this UI proposal does not assume registration also issues a JWT.

## User Flow

1. Complete the fields.
2. Submit; server validates input and assigns USER.
3. On success display account-created confirmation and navigate to Sign In.
4. On 422 show field errors; on case-insensitive duplicate email show 409 feedback.

## Notes

No role selector; public registration cannot grant ADMIN. Never show password_hash or log plaintext passwords. Password hashing remains server-side bcrypt/Argon2.

[Associated editable SVG mockup](assets/ui-account.svg).

---

# Screen: Review Editor

## Purpose

Create a single review for a facility or edit/delete the current user’s existing review.

Requirements: FR-03 with FR-08 and FR-10. Actors: Registered author; ADMIN may delete other reviews through Administration.

## Layout

Dialog or Single Column Panel linked to selected facility.

## Components

- Header: facility name and close/cancel Button.
- Radio Button: integer cleanliness score 1–5.
- Textbox: optional comment with 1000-character limit and character-count Label.
- Button: Submit for new review; Save changes and Delete my review for an existing one.
- Label: pending, success, validation, duplicate or forbidden feedback.

## Actions

- Create; edit own score/comment; delete own review; cancel to details.

## Navigation

From Facility Details after authentication. Success returns to refreshed Facility Details. Other users do not see an edit action for a review they do not own.

## User Flow

1. Open and load own current review, if any.
2. Choose score and optional comment; submit the appropriate create or edit request.
3. Show field errors without losing the entered text.
4. On success refresh the actual review list, mean and count; load summary separately after invalidation.

## Notes

One current review per non-null user/facility pair. Duplicate POST returns 409 with guidance to edit. Invalid score or overlong comment returns 422. Missing/invalid authentication returns 401; forbidden modification 403. Owner edits/deletes; ADMIN role alone does not permit editing another user’s review. Render user text as text, never HTML.

[Associated editable SVG mockup](assets/ui-contribute.svg).

---

# Screen: Suggest Facility

## Purpose

Submit a missing facility for administrator review without publishing it immediately.

Requirements: FR-05 with FR-08. Actors: Registered user.

## Layout

Single Column; form Panel with explicit coordinates and optional amenity choices.

## Components

- Textbox: name, district, latitude and longitude (required).
- Dropdown: accessibility, baby changing and price; optional/unknown by default.
- Button: Send suggestion and Cancel.
- Label: coordinate/field errors and receipt containing suggestion ID and pending status.

## Actions

- Enter metadata; submit suggestion; cancel to map; correct invalid fields.

## Navigation

From Discovery Map or Facility Details. Guests go through Sign In. After receipt return to map without adding a public marker for the pending suggestion.

## User Flow

1. Complete required name, district and coordinates.
2. Submit with authentication.
3. On valid input show 202 receipt with pending status and identifier.
4. On validation/authentication failure show feedback; preserve safe entered form values for correction.

## Notes

Coordinates must be valid; optional unknown values are not false. Pending/rejected suggestions remain outside public facilities. No new user-facing suggestion-history endpoint or status-tracking feature is assumed.

[Associated editable SVG mockup](assets/ui-contribute.svg).

---

# Screen: Account Privacy

## Purpose

Explain and request deletion of personal account data while retaining anonymized review scores.

Requirements: FR-10 with FR-08. Actors: Registered user, including an administrator acting on their own account.

## Layout

Single Column; account information and deletion Section.

## Components

- Header: Account and Back to map.
- Label: account identity visible only to its owner.
- Section: explanation of account removal, Anonymous attribution, retained scores and personal-text removal/redaction.
- Button: Delete my account.
- Label: processing, failure and completed deletion feedback.

## Actions

- Request self-account deletion; return to map.

## Navigation

From authenticated Account navigation. Completed deletion returns to guest Discovery Map and clears the local session. Failure remains on the screen with a clear incomplete status.

## User Flow

1. Read the effect of deletion.
2. Request DELETE /api/v1/users/me.
3. Wait for completion of all personal-data and affected-cache cleanup obligations.
4. Only after 204 show completion, clear the session and return to guest browsing.

## Notes

No extra reauthentication/password-confirmation requirement is invented. Existing tokens must fail once the account no longer exists. Pattern-based redaction alone does not guarantee complete PII removal; durable recovery and residual personal-text handling need design review. Retained scores keep aggregates unchanged.

[Associated editable SVG mockup](assets/ui-account.svg).

---

# Screen: Administration

## Purpose

Inspect hygiene analytics, moderate suggestions/reviews, close facilities and import/export facility data.

Requirements: FR-05, FR-06, FR-07, FR-10 with FR-08. Actors: ADMIN.

## Layout

Dashboard with Tabs: Analytics, Moderation and Import. Header and date/district Toolbar shared by analytics and export. Stack Cards/Table on narrow screens.

## Components

- Toolbar: district Dropdown; last 30 days (default), last 7 days or custom Date Pickers from/to.
- Cards: period mean, review count and administrative active-facility ratio.
- Chart: hygiene trend; Table: selected-period facility metrics.
- Label: “Acil Müdahale Gerekli” when the mean is strictly below 3.5; no-data state otherwise as applicable.
- Buttons: Export CSV and Export JSON using the active selection.
- Moderation Table/Panel: pending suggestion metadata and approve/reject Buttons; review selection and delete Button.
- Dropdown and Button: facility status ACTIVE/CLOSED/MAINTENANCE and Save status.
- File Upload: CSV/JSON batch; Import Button; counts and per-row error Table.

## Actions

- Change district/date selection and inspect all analytics views using that same selection.
- Export current selection; import a CSV/JSON facility batch.
- Approve/reject a selected suggestion; delete a review; update facility status.

## Navigation

From ADMIN navigation after authorization. Tabs change the administrative workspace; Back to map returns to discovery. USER access receives forbidden feedback; invalid/expired authentication leads to Sign In.

## User Flow

1. Authorize ADMIN before loading protected data.
2. Resolve district and inclusive local dates over review created_at; refresh KPI, chart and table together.
3. Export those filters in the requested format, or upload/validate an entire import batch.
4. For moderation inspect the target, submit a permitted decision/status change and refresh the corresponding view.

## Notes

No reviews: mean=null, count=0, “No data”; no fabricated zero rating. District KPI averages individual eligible reviews, not facility means. Active ratio is administrative status, not occupancy. Export columns are facility_id,district,hygiene_score,open_issues_count,last_cleaned_at. Missing operational values are blank CSV/null JSON. Invalid import returns 422 and row errors with no committed batch rows. Provider ID is retained only when real. Pending/rejected suggestions never become public markers; closure preserves reviewed facility history. Duplicate/repeated decisions and rejected-count definition remain design choices.

[Associated editable SVG mockup](assets/ui-admin.svg).

---

# Review coverage

| Screen | Requirements | Mockup plate | Existing acceptance references |
|---|---|---|---|
| Discovery Map | FR-01, FR-02, FR-09 | ui-map | TC-01–03, TC-11–14, TC-21–23 |
| Facility Details | FR-03, FR-04, FR-09 | ui-map | TC-08, TC-15–17, TC-21 UI, TC-28 |
| Sign In | FR-08 | ui-account | TC-04, TC-39–43, TC-47 |
| Register | FR-08 | ui-account | TC-30, TC-37, TC-38, TC-48 |
| Review Editor | FR-03 | ui-contribute | TC-05, TC-06, TC-26, TC-31, TC-32, TC-35, TC-46 |
| Suggest Facility | FR-05 | ui-contribute | TC-07 |
| Account Privacy | FR-10 | ui-account | TC-34 |
| Administration | FR-05–08, FR-10 | ui-admin | TC-09, TC-10, TC-18–20, TC-24, TC-25, TC-27, TC-36, TC-44, TC-45 |

References mean specified acceptance coverage, not passing browser tests. TC-21 HTTP checks the initial HTML shell only; its marker interaction and TC-22/23 remain manual. Keyboard access, focus restoration, field labels, non-color-only feedback and narrow-screen layout must be refined and verified during frontend design/implementation. No new user role, endpoint or business capability is introduced by this document.
