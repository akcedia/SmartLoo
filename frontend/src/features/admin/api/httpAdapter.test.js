import { describe, expect, it } from "vitest";
import { createApiClient } from "../../../shared/http/apiClient.js";
import { createHttpAdapter, filenameFrom } from "./httpAdapter.js";

const filters = { district: "Kadıköy", from: "2026-11-01", to: "2026-11-07" };

function adapterWith(responder) {
  const calls = [];
  const client = createApiClient({
    getToken: () => "admin-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responder(url);
    },
  });
  return { adapter: createHttpAdapter({ client }), calls };
}

describe("live admin adapter", () => {
  it("requests the summary with the selected filters and the session token", async () => {
    const { adapter, calls } = adapterWith(() => Response.json({ review_count: 0, average_cleanliness: null, critical_alert: false }));
    const data = await adapter.fetchSummary(filters);
    expect(adapter.isSample).toBe(false);
    expect(data.average_cleanliness).toBeNull();
    expect(calls[0].url).toBe("/api/v1/admin/metrics/summary?district=Kad%C4%B1k%C3%B6y&from=2026-11-01&to=2026-11-07");
    expect(calls[0].init.headers.Authorization).toBe("Bearer admin-token");
  });

  it("downloads the export with the same filters, server filename and Turkish characters intact", async () => {
    const csv = "﻿facility_id,district,hygiene_score,open_issues_count,last_cleaned_at\r\nf-1,Kadıköy,,,\r\n";
    const { adapter, calls } = adapterWith(() => new Response(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"smartloo-hygiene-Kadikoy-2026-11-01_2026-11-07.csv\"; filename*=UTF-8''smartloo-hygiene-Kad%C4%B1k%C3%B6y-2026-11-01_2026-11-07.csv" },
    }));
    const file = await adapter.fetchExport(filters, "csv");
    expect(calls[0].url).toBe("/api/v1/admin/analytics/export?format=csv&district=Kad%C4%B1k%C3%B6y&from=2026-11-01&to=2026-11-07");
    expect(file.filename).toBe("smartloo-hygiene-Kadıköy-2026-11-01_2026-11-07.csv");
    expect(file.mimeType).toBe("text/csv; charset=utf-8");
    const bytes = new Uint8Array(await file.body.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain("Kadıköy");
  });

  it("throws on error responses so an error body is never saved as a report", async () => {
    for (const status of [401, 403, 422, 500, 501]) {
      const { adapter } = adapterWith(() => Response.json({ detail: "x" }, { status }));
      await expect(adapter.fetchExport(filters, "json")).rejects.toMatchObject({ status });
    }
  });

  it("names a download without Content-Disposition after the selection", async () => {
    const { adapter } = adapterWith(() => Response.json({ count: 0, results: [] }));
    const file = await adapter.fetchExport(filters, "json");
    expect(file.filename).toBe("smartloo-hygiene-Kadıköy-2026-11-01_2026-11-07.json");
    const all = await adapter.fetchExport({ district: null, from: "2026-11-01", to: "2026-11-07" }, "json");
    expect(all.filename).toBe("smartloo-hygiene-all-2026-11-01_2026-11-07.json");
  });

  it("reads plain and RFC 5987 filenames", () => {
    expect(filenameFrom('attachment; filename="a.csv"', "x")).toBe("a.csv");
    expect(filenameFrom("attachment; filename*=UTF-8''Kad%C4%B1k%C3%B6y.json", "x")).toBe("Kadıköy.json");
    expect(filenameFrom(null, "fallback.csv")).toBe("fallback.csv");
    expect(filenameFrom("attachment; filename=\"plain.csv\"; filename*=UTF-8''%E2%9C%93.csv", "x")).toBe("✓.csv");
  });
});
