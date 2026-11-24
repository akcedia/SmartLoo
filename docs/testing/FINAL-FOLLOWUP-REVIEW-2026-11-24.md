# Final follow-up review — 24 November 2026

Read-only GitHub audit. Main remains `7b824134`; AI candidate #89 remains draft
at `db98338`. No merge, publication, deployment or checklist tick is implied.

## New contributions

- Yusuf #76: `294fd181`, open, not draft, requested reviewer akcedia. Seven
  workflows passed. Inspected the actual job steps: ADMIN import and mounted
  moderation/status tests executed successfully with no-skip gates. Report and
  PDF remain review artifacts, not instructor approval or Learn submission.
- Emir #99: `5c17374`, draft against #89. TR/EN UI, Turkish model content retained
  verbatim and marked with its language, no refetch on language switch.
- Emir #100: `87726acc`, draft against #89. Async synthetic provider, explicit v3
  composition, cache and grounded-reason assertions. No production code changes.
- No new Furkan feature PR was visible in the open-PR audit. A user-facing
  facility suggestion form remains outstanding. Fırat/Onur deliveries #93–98
  were already incorporated into main; do not duplicate them.

#99 and #100 have no PR-triggered workflow runs because they target the AI
integration branch rather than main; they are not failed CI runs. Validate their
combined candidate before publishing an updated #89.

## Local review

Local branch `review/24-final-followups` combines the exact #99/#100 heads; merge
commit `83e566b`. Independent Windows verification:

- `npm test`: 292 passed, 22 files, exit 0; production build passed.
- `tests/test_requirements.py`: 50 passed, 2 failed, no skips. Independently
  reproduced both contributors' reported result.
- Small review corrections: use the shared text token for the recommendation
  fallback (readable in both themes); include the two AI screens in the existing
  translation catalog coverage gate. Afterward, 13 affected frontend tests passed
  and the production build passed again.
- Real local PostgreSQL/PostGIS, MongoDB and scoped Redis: **187 passed**,
  25 subtests, zero failures/errors/skips; JUnit no-skip gate passed. Mounted
  AI UI against the real stores/API: **4 passed**, zero failures/errors/skips.
  Synthetic model only; no Gemini request. All 13 seeded facilities remained;
  zero users/recovery operations/suggestions remained, and the private SQL and
  root Mongo test databases were removed. The catalog separately remained 50/2.
  [Receipt](evidence/followups-2026-11-24/result.json),
  [backend JUnit](evidence/followups-2026-11-24/backend.xml),
  [mounted UI JUnit](evidence/followups-2026-11-24/ai-ui.xml),
  [unchanged catalog JUnit](evidence/followups-2026-11-24/catalog.xml).

Visual browser/mobile acceptance of #99 is still open; mounted tests are not a
replacement. The map-only change has its own earlier browser evidence.

### Open catalog decisions

**TC-21:** API-only factory GET / is not the deployed frontend composition. The
old initial-HTML element assertions also predate React's client rendering. Do
not add fake hidden map controls or change API responses to green this test.
Proposed split: test the built shell/assets through `create_cloud_app`, and test
the rendered controls/detail interaction in a browser. Yusuf's separate seven
browser checks at main and 12 cloud-factory tests are scoped supporting evidence;
they do not make the unchanged catalog assertion pass.

**TC-28:** One unsafe review out of three is excluded, leaving two eligible
reviews, so the existing >=3-eligible rule correctly prevents a provider call.
The old `return_value` assignment also cannot override #100's new mock
`side_effect`. Proposed correction: retain a below-threshold zero-call case and
add a four-total/three-eligible case with an explicitly invalid provider return,
one awaited call and a check that the unsafe text/PII never reaches it. Review
the fixture and readable case description together; keep the original red result.
No validation or privacy rule should be weakened.

## Report review and release order

1. Publish the already-tested independent map-density/light-default change only
   with Özgür's approval. Its local commit is `96e93f6` (295 frontend passes).
2. Review #99/#100 jointly in draft #89, resolve the catalog decisions, finish
   mounted and visual TR/EN/mobile acceptance and independent human AI labels.
   The published AI-assisted preliminary labels are not independent human review.
3. Keep #76 open for the requested internal and instructor review; assign Yeşim
   by 25 November after coordination. Refresh evidence after final integration.
   Report NFR rows still repeat historical partial findings; reconcile them with
   the current main/cloud receipts without claiming unmeasured acceptance.
4. Yusuf's remaining work: >=80% final backend coverage (currently reported
   77.23%), post-#95 SonarQube, prescribed five-minute load run, security and
   penetration findings/retests, browser/accessibility evidence and final PDF QA.
5. Integrate the remaining user suggestion screen and finish deployment settings,
   migration 008, final smoke, README/versioning/AI traceability and clean package.
   Each cloud/GitHub write needs its own concrete approval.

Old draft #68/#86/#87 must not be merged separately on top of #89. #69 also
remains draft; close superseded PRs only after replacement acceptance and approval.

Charter retains the old 22 November report date; the newer instructor schedule
and #82 require report PR/reviewer on 25 November and approved PDF on Learn by
29 November. Charter codebase deadline is 30 November 23:59; team target is 29th.
Monthly availability cannot be proved within this week's test window.
