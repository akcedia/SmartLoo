# User suggestion form — 24 November 2026

Refs #57 #56 #58 #82. Based on main `7b824134` and the existing FR-05 contract.
No backend service, migration or ownership logic was rewritten.

## Behavior

Signed-in users open **Tesis öner / Suggest a facility** from the account menu
(`/suggest`, including direct navigation and sign-in return path). Submit name,
district and facility coordinates; amenities have explicit true/false/unknown
choices. Personal geolocation is not read or automatically submitted by this form.
The shared authenticated client POSTs once to the existing suggestions endpoint.
Only HTTP 202 with a pending ID confirms success; pending facilities are not
published on the map. ADMIN uses the existing moderation screen to approve them.

Validation preserves input and focuses errors. While sending, duplicate submits
are blocked. An uncertain response does not claim success or automatically retry;
the user is asked to have an administrator check before resubmission. Server-side
authorization and validation remain authoritative. All form text uses TR/EN.

## Verification

- 293 frontend tests passed, 22 files; production build passed.
- Seven new mounted component cases cover guest gating, validation/focus,
  authenticated request shape, true/false/null, in-flight duplicate protection,
  HTTP 200/network/503 uncertainty, 422 recovery and English labels.
- 27 backend tests passed with real local PostgreSQL enabled, no skips.
- Expanded existing real-service moderation suite: one multi-step test passed,
  no skips. Actual mounted USER form submits once; HTTP response is pending;
  unknown facts remain null; the facility is absent from nearby results before
  approval. Mounted ADMIN approval then makes its detail HTTP 200. Existing
  rejection, conflict, closure and preserved review checks still pass.
- Test cleanup retains the 13 original synthetic seed facilities and leaves
  zero users, suggestions and review operations. Private SQL DB removed. The
  runner also removes its unique Mongo database. No live model requests.
- Real Brave production-build preview, synthetic local account/in-memory data:
  guest sign-in return, form submission and pending message verified; Turkish to
  English switching preserves the confirmed outcome. At 375x812 no horizontal
  overflow. Dark and light form/result appearance inspected. This separate
  browser smoke is not the PostgreSQL evidence above.

Receipts: `evidence/user-suggestion-2026-11-24/`. Local screenshots remain in
ignored `.venv/suggestion-mobile.png` and `.venv/suggestion-confirmed-mobile.png`.
No cloud data or public account was used. GitHub publication, main merge and
production release remain separate approval steps. Production needs migration
008 before this feature is activated.
