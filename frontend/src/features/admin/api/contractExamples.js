// Example responses copied from docs/contracts/admin-analytics-api.md (v0.2).
// Test data only: never imported by the app, never shown as live data.
// If the contract changes, update these and the tests that use them together.

const F1 = "00000000-0000-4000-8000-000000000001";
const filters = (from, to, district = "Kadıköy") => ({ district, from, to, timezone: "Europe/Istanbul" });
const emptyDay = (date) => ({ date, average_cleanliness: null, review_count: 0 });

// §2.2 — TC-09: Kadıköy reviews 4 and 2 in the interval; September and Beşiktaş excluded.
export const SUMMARY_TC09 = {
  filters: filters("2026-10-01", "2026-10-07"),
  average_cleanliness: 3.0,
  review_count: 2,
  critical_alert: true,
  critical_threshold: 3.5,
  active_facility_ratio: { active: 1, total: 1 },
  trend: [
    emptyDay("2026-10-01"),
    { date: "2026-10-02", average_cleanliness: 4.0, review_count: 1 },
    { date: "2026-10-03", average_cleanliness: 2.0, review_count: 1 },
    emptyDay("2026-10-04"),
    emptyDay("2026-10-05"),
    emptyDay("2026-10-06"),
    emptyDay("2026-10-07"),
  ],
  facilities: [
    { facility_id: F1, name: "Example facility", district: "Kadıköy", status: "ACTIVE", hygiene_score: 3.0, review_count: 2 },
  ],
};

// §2.3 — TC-25: facility exists, zero eligible reviews.
export const SUMMARY_NO_REVIEWS = {
  filters: filters("2026-10-01", "2026-10-02"),
  average_cleanliness: null,
  review_count: 0,
  critical_alert: false,
  critical_threshold: 3.5,
  active_facility_ratio: { active: 1, total: 1 },
  trend: [emptyDay("2026-10-01"), emptyDay("2026-10-02")],
  facilities: [
    { facility_id: F1, name: "Example facility", district: "Kadıköy", status: "ACTIVE", hygiene_score: null, review_count: 0 },
  ],
};

// §2.3 last paragraph — no matched facilities (also an unknown district, §1).
export const SUMMARY_NO_FACILITIES = {
  filters: filters("2026-10-01", "2026-10-02", "Adalar"),
  average_cleanliness: null,
  review_count: 0,
  critical_alert: false,
  critical_threshold: 3.5,
  active_facility_ratio: null,
  trend: [emptyDay("2026-10-01"), emptyDay("2026-10-02")],
  facilities: [],
};

// TC-09/TC-25 HTTP tests assert only the three required fields; a first backend
// version may return just these.
export const SUMMARY_REQUIRED_ONLY = { average_cleanliness: 3.0, review_count: 2, critical_alert: true };

// §3.2 / §3.3 — export of the TC-09 selection.
export const EXPORT_CSV_TC09 =
  "﻿facility_id,district,hygiene_score,open_issues_count,last_cleaned_at\r\n" + `${F1},Kadıköy,3.0,,\r\n`;

export const EXPORT_JSON_TC09 = {
  filters: filters("2026-10-01", "2026-10-07"),
  count: 1,
  results: [{ facility_id: F1, district: "Kadıköy", hygiene_score: 3.0, open_issues_count: null, last_cleaned_at: null }],
};

export const EXPORT_CSV_EMPTY = "﻿facility_id,district,hygiene_score,open_issues_count,last_cleaned_at\r\n";
