import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, isCritical } from "./contract.js";
import { presetRange, validateRange } from "./dateRange.js";
import { buildExportRows, buildSummary, exportFilename, toCsv } from "./metrics.js";
import { createSampleAdapter, createSampleDataset } from "./sampleAdapter.js";
import { buildQuery } from "./httpAdapter.js";

const KADIKOY = "00000000-0000-4000-8000-000000000001";
const BESIKTAS = "00000000-0000-4000-8000-000000000002";

// Same shape as TC-09 in tests/requirements_cases.json.
const tc09 = {
  facilities: [
    { facility_id: KADIKOY, name: "K", district: "Kadıköy", status: "ACTIVE" },
    { facility_id: BESIKTAS, name: "B", district: "Beşiktaş", status: "ACTIVE" },
  ],
  reviews: [
    { facility_id: KADIKOY, cleanliness_score: 4, created_at: "2026-10-02T10:00:00+03:00" },
    { facility_id: KADIKOY, cleanliness_score: 2, created_at: "2026-10-03T10:00:00+03:00" },
    { facility_id: KADIKOY, cleanliness_score: 5, created_at: "2026-09-01T10:00:00+03:00" },
    { facility_id: BESIKTAS, cleanliness_score: 5, created_at: "2026-10-03T10:00:00+03:00" },
  ],
};
const tc09Filters = { district: "Kadıköy", from: "2026-10-01", to: "2026-10-07" };

describe("summary rules (FR-06)", () => {
  it("matches TC-09: district and date filter, alert below 3.5", () => {
    const s = buildSummary(tc09, tc09Filters);
    expect(s.average_cleanliness).toBe(3);
    expect(s.review_count).toBe(2);
    expect(s.critical_alert).toBe(true);
    expect(s.trend).toHaveLength(7);
    expect(s.trend.find((d) => d.date === "2026-10-01").average_cleanliness).toBeNull();
    expect(s.facilities.map((f) => f.facility_id)).toEqual([KADIKOY]);
  });

  it("matches TC-25: no reviews gives null average, never 0", () => {
    const s = buildSummary({ facilities: tc09.facilities, reviews: [] }, { district: null, from: "2026-10-01", to: "2026-10-07" });
    expect(s.average_cleanliness).toBeNull();
    expect(s.review_count).toBe(0);
    expect(s.critical_alert).toBe(false);
  });

  it("averages individual reviews, not facility means", () => {
    const data = {
      facilities: [
        { facility_id: "a", district: "Kadıköy", status: "ACTIVE" },
        { facility_id: "b", district: "Kadıköy", status: "ACTIVE" },
      ],
      reviews: [
        ...[5, 5, 5, 5].map((s) => ({ facility_id: "a", cleanliness_score: s, created_at: "2026-10-02T10:00:00+03:00" })),
        { facility_id: "b", cleanliness_score: 1, created_at: "2026-10-02T10:00:00+03:00" },
      ],
    };
    const s = buildSummary(data, tc09Filters);
    expect(s.average_cleanliness).toBeCloseTo(4.2);
    expect(s.critical_alert).toBe(false);
  });

  it("uses inclusive Istanbul dates (half-open at the next midnight)", () => {
    const at = (ts) => ({ facilities: tc09.facilities, reviews: [{ facility_id: KADIKOY, cleanliness_score: 4, created_at: ts }] });
    expect(buildSummary(at("2026-10-07T23:59:59+03:00"), tc09Filters).review_count).toBe(1);
    expect(buildSummary(at("2026-10-08T00:00:00+03:00"), tc09Filters).review_count).toBe(0);
    // 30 Sep 21:30 UTC is already 1 Oct 00:30 in Istanbul.
    expect(buildSummary(at("2026-09-30T21:30:00Z"), tc09Filters).review_count).toBe(1);
  });

  it("threshold is strict", () => {
    expect(isCritical(3.5)).toBe(false);
    expect(isCritical(3.49)).toBe(true);
    expect(isCritical(null)).toBe(false);
  });

  it("reports Unknown active ratio when status data is missing", () => {
    const data = { facilities: [{ facility_id: KADIKOY, district: "Kadıköy" }], reviews: tc09.reviews };
    expect(buildSummary(data, tc09Filters).active_facility_ratio).toBeNull();
  });
});

describe("date filter", () => {
  it("last 30 days includes today", () => {
    expect(presetRange("last30", "2026-10-19")).toEqual({ from: "2026-09-20", to: "2026-10-19" });
    expect(presetRange("last7", "2026-10-19")).toEqual({ from: "2026-10-13", to: "2026-10-19" });
  });

  it("rejects malformed and reversed ranges", () => {
    expect(validateRange({ from: "2026-10-01", to: "2026-10-07" })).toEqual({});
    expect(validateRange({ from: "2026-02-30", to: "2026-10-07" })).toHaveProperty("from");
    expect(validateRange({ from: "2026-10-08", to: "2026-10-07" })).toHaveProperty("to");
  });
});

describe("export (FR-07)", () => {
  it("uses the five contract columns, BOM and blank missing values", () => {
    const rows = buildExportRows(tc09, tc09Filters);
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(lines[1]).toBe(`${KADIKOY},Kadıköy,3,,`);
    expect(rows[0].open_issues_count).toBeNull();
    expect(rows[0].last_cleaned_at).toBeNull();
  });

  it("quotes values per RFC 4180", () => {
    const csv = toCsv([{ facility_id: 'a"b', district: "x,y", hygiene_score: null, open_issues_count: 0, last_cleaned_at: null }]);
    expect(csv).toContain('"a""b","x,y",,0,');
  });

  it("names the file after the selection", () => {
    expect(exportFilename(tc09Filters, "csv")).toBe("smartloo-hygiene-Kadıköy-2026-10-01_2026-10-07.csv");
    expect(exportFilename({ district: null, from: "a", to: "b" }, "json")).toBe("smartloo-hygiene-all-a_b.json");
  });

  it("sends district/from/to/format with the contract names", () => {
    expect(buildQuery(tc09Filters, "csv")).toBe("format=csv&district=Kad%C4%B1k%C3%B6y&from=2026-10-01&to=2026-10-07");
    expect(buildQuery({ district: null, from: "2026-10-01", to: "2026-10-07" })).toBe("from=2026-10-01&to=2026-10-07");
  });
});

describe("sample adapter", () => {
  it("is labelled as sample and produces data for the default period", async () => {
    const adapter = createSampleAdapter({ dataset: createSampleDataset("2026-10-19") });
    expect(adapter.isSample).toBe(true);
    const s = await adapter.fetchSummary({ district: null, ...presetRange("last30", "2026-10-19") });
    expect(s.review_count).toBeGreaterThan(0);
  });

  it("returns no data for a district without reviews", async () => {
    const adapter = createSampleAdapter({ dataset: createSampleDataset("2026-10-19") });
    const s = await adapter.fetchSummary({ district: "Üsküdar", ...presetRange("last30", "2026-10-19") });
    expect(s.average_cleanliness).toBeNull();
  });

  it.each([["unauthorized", 401], ["forbidden", 403], ["error", 500]])("simulates %s", async (scenario, status) => {
    const adapter = createSampleAdapter({ getScenario: () => scenario });
    await expect(adapter.fetchSummary(tc09Filters)).rejects.toMatchObject({ status });
  });

  it("rejects invalid filters with 422", async () => {
    const adapter = createSampleAdapter();
    await expect(adapter.fetchSummary({ district: null, from: "2026-10-08", to: "2026-10-07" })).rejects.toMatchObject({ status: 422 });
  });
});
