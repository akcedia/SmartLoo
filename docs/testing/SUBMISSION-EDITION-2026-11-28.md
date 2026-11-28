# Learn submission edition — 28 November 2026

The owner authorized publishing the prepared 16-page Software Test Plan and Testing Report, squash-merging #106 after successful checks, and closing #76 as superseded. This repository decision is not a recorded faculty approval. No review is dismissed and no Learn upload is claimed.

## Changes and evidence

- `SOFTWARE_TESTING_REPORT.md`: adds the explicit plan, ownership, entry/exit criteria, document cover and subsequent successful CI receipts to the measured report. All numerical results and limits are retained.
- `SOFTWARE_TESTING_REPORT.pdf` and its legacy `SOFTWARE_TESTING_REPORT_DRAFT.pdf` alias: the exact same 16-page PDF supplied to the owner for Learn. `evidence/SUBMISSION-EDITION-2026-11-28.json` records its SHA-256.
- `scripts/build_testing_report_pdf.py`: reproduces the submission edition's content/layout from the versioned source. Raw results remain pinned to snapshot d9b54e8; runtime source remains 3033321.
- `evidence/INSTRUCTOR-REVIEW-82.md`: current point-by-point response map. The original 26 November receipt is explicitly scoped to its immutable snapshot.

## AI assistance and human decision

Codex assembled the submission layout, explicit testing plan, evidence links and publication records from the existing Charter/requirements and executed results. The owner reviewed the prepared PDF and explicitly authorized publication, squash merge and duplicate closure. No human AI labels, new test results, native-model calls or instructor approvals were inferred.

## Verification

The prepared PDF was rendered and visually reviewed across all 16 pages. Automated content/layout checks found zero overflowing characters, verified all 48 acceptance IDs, all six team names and 17 pinned evidence links. Existing measured results remain 572 backend cases +59 subtests, 309 frontend component tests, 14 guards, Sonar gate OK and local load p95 167.26 ms. The PDF generator is rerun and its extracted content compared before publication. Exact-head GitHub CI is checked again before the authorized merge.

The original requested-changes review remains available in #76; #106 is the `test_work` correction. Actual merge and closure are recorded by GitHub, separately from this preparation receipt. Learn's PDF upload is still a separate step.
