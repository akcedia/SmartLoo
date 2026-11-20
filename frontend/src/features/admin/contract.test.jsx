// Live-mode panel against the example responses in docs/contracts/admin-analytics-api.md.
// These verify the frontend side of the contract; they are not a live backend check.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createApiClient } from "../../shared/http/apiClient.js";
import { createHttpAdapter, normalizeSummary } from "./api/httpAdapter.js";
import { CRITICAL_ALERT_TEXT, EXPORT_COLUMNS } from "./api/contract.js";
import {
  EXPORT_CSV_EMPTY,
  EXPORT_CSV_TC09,
  EXPORT_JSON_TC09,
  SUMMARY_NO_FACILITIES,
  SUMMARY_NO_REVIEWS,
  SUMMARY_REQUIRED_ONLY,
  SUMMARY_TC09,
} from "./api/contractExamples.js";
import { DashboardContent, serverFilterErrors } from "./AdminDashboard.jsx";
import { exportErrorMessage } from "./components/ExportButtons.jsx";

function liveAdapter(responder) {
  const calls = [];
  const client = createApiClient({
    getToken: () => "admin-token",
    fetchImpl: async (url) => {
      calls.push(url);
      return responder(url);
    },
  });
  return { adapter: createHttpAdapter({ client }), calls };
}

const query = { district: "Kadıköy", from: "2026-10-01", to: "2026-10-07" };

async function renderLive(response) {
  const { adapter } = liveAdapter(() => Response.json(response));
  const data = await adapter.fetchSummary(query);
  return renderToStaticMarkup(<DashboardContent status="success" data={data} adapter={adapter} query={query} />);
}

describe("summary contract examples (FR-06)", () => {
  it("TC-09: shows the API mean, count and alert without recomputing them", async () => {
    const html = await renderLive(SUMMARY_TC09);
    expect(html).toContain("3.00");
    expect(html).toContain(CRITICAL_ALERT_TEXT);
    expect(html).toContain("admin-card--critical");
    expect(html).not.toContain("Veri yok</p>");
    // 7 trend days, 2 with reviews: two points, null days stay gaps.
    expect(html.match(/<circle/g)).toHaveLength(2);
  });

  it("the KPI is the API's review-weighted mean, never the mean of facility scores", async () => {
    // Facility A 5.0 (4 reviews) and B 1.0 (1 review): API mean 4.2; mean of facility means would be 3.0.
    const response = {
      ...SUMMARY_TC09,
      average_cleanliness: 4.2,
      review_count: 5,
      critical_alert: false,
      facilities: [
        { facility_id: "a", name: "A", district: "Kadıköy", status: "ACTIVE", hygiene_score: 5.0, review_count: 4 },
        { facility_id: "b", name: "B", district: "Kadıköy", status: "ACTIVE", hygiene_score: 1.0, review_count: 1 },
      ],
    };
    const html = await renderLive(response);
    expect(html).toContain("4.20");
    expect(html).not.toContain(CRITICAL_ALERT_TEXT);
  });

  it("the alert follows the API flag (threshold is strict, 3.5 is not critical)", async () => {
    const html = await renderLive({ ...SUMMARY_TC09, average_cleanliness: 3.5, critical_alert: false });
    expect(html).toContain("3.50");
    expect(html).not.toContain(CRITICAL_ALERT_TEXT);
  });

  it("TC-25: zero reviews shows 'Veri yok', keeps the facility row and never shows 0", async () => {
    const html = await renderLive(SUMMARY_NO_REVIEWS);
    expect(html).toContain("Veri yok");
    expect(html).toContain("bu tesisler için değerlendirme bulunmuyor");
    expect(html).toContain("Example facility");
    expect(html).not.toContain("0.00");
    expect(html).not.toContain(CRITICAL_ALERT_TEXT);
    expect(html).toContain("%100");
    expect(html).toContain("trend verisi yok");
  });

  it("no matched facilities: empty table, 'Tesis yok' ratio and a facility-specific message", async () => {
    const html = await renderLive(SUMMARY_NO_FACILITIES);
    expect(html).toContain("Seçilen ilçede eşleşen tesis yok");
    expect(html).toContain("Bu seçimde tesis yok");
    expect(html).toContain("Tesis yok");
    expect(html).not.toContain("Bilinmiyor");
  });

  it("accepts a first backend version with only the required fields", async () => {
    const html = await renderLive(SUMMARY_REQUIRED_ONLY);
    expect(html).toContain("3.00");
    expect(html).toContain(CRITICAL_ALERT_TEXT);
    // Missing lists are "not provided", never "no facilities".
    expect(html).toContain("Bilinmiyor");
    expect(html).toContain("tesis listesini göndermedi");
    expect(html).toContain("günlük trendi göndermedi");
    expect(html).not.toContain("Tesis yok");
  });

  it("rejects a response that breaks the required fields instead of showing wrong numbers", () => {
    expect(() => normalizeSummary({ average_cleanliness: "3.0", review_count: 2, critical_alert: true })).toThrow();
    expect(() => normalizeSummary({ average_cleanliness: 0, review_count: 0 })).toThrow();
    expect(() => normalizeSummary(null)).toThrow();
    expect(normalizeSummary(SUMMARY_TC09)).toEqual(SUMMARY_TC09);
  });
});

describe("errors stay distinct from empty results", () => {
  const render = (error) => renderToStaticMarkup(<DashboardContent status="error" error={error} onRetry={() => {}} />);

  it.each([
    [401, "Oturum gerekli"],
    [403, "Yetkiniz yok"],
    [422, "Filtre geçersiz"],
    [500, "Sunucu hatası"],
    [502, "Sunucu hatası"],
    [503, "Sunucu hatası"],
    [501, "henüz hazır değil"],
    [0, "Sunucuya ulaşılamadı"],
  ])("status %s shows its own state and never 'Veri yok'", (status, text) => {
    const html = render({ status });
    expect(html).toContain(text);
    expect(html).not.toContain("Veri yok");
  });

  it("a review-store failure (5xx) offers Retry, an empty result does not", async () => {
    expect(render({ status: 503 })).toContain("Tekrar dene");
    expect(await renderLive(SUMMARY_NO_REVIEWS)).not.toContain("Tekrar dene");
  });

  it("server 422 field errors are shown next to the date controls", () => {
    expect(serverFilterErrors({ status: 422, fieldErrors: { from: "Input should be a valid date", to: "x", other: "y" } })).toEqual({
      from: "Sunucu başlangıç tarihini kabul etmedi.",
      to: "Sunucu bitiş tarihini kabul etmedi.",
    });
    expect(serverFilterErrors({ status: 500 })).toEqual({});
  });

  it("loading without data shows the skeleton", () => {
    expect(renderToStaticMarkup(<DashboardContent status="loading" data={null} />)).toContain("admin-skeleton");
  });
});

describe("export contract examples (FR-07, TC-10, TC-24)", () => {
  it("summary and export use the same district/date selection", async () => {
    const { adapter, calls } = liveAdapter((url) =>
      url.includes("/export") ? new Response(EXPORT_CSV_TC09, { headers: { "Content-Type": "text/csv; charset=utf-8" } }) : Response.json(SUMMARY_TC09),
    );
    await adapter.fetchSummary(query);
    await adapter.fetchExport(query, "csv");
    const params = (u) => Object.fromEntries(new URL(u, "http://x").searchParams);
    const { format, ...exportFilters } = params(calls[1]);
    expect(format).toBe("csv");
    expect(exportFilters).toEqual(params(calls[0]));
  });

  it("CSV keeps the BOM, the five columns and blank missing values", async () => {
    const { adapter } = liveAdapter(() => new Response(EXPORT_CSV_TC09, { headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    const file = await adapter.fetchExport(query, "csv");
    const text = new TextDecoder().decode(await file.body.arrayBuffer());
    // TextDecoder drops the BOM by default; check the raw bytes for it.
    expect(Array.from(new Uint8Array(await file.body.arrayBuffer()).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const [header, row] = text.split("\r\n");
    expect(header).toBe(EXPORT_COLUMNS.join(","));
    expect(row).toMatch(/,Kadıköy,3\.0,,$/);
  });

  it("JSON export keeps results with null operational values", async () => {
    const { adapter } = liveAdapter(() => Response.json(EXPORT_JSON_TC09));
    const file = await adapter.fetchExport(query, "json");
    const body = JSON.parse(await file.body.text());
    expect(body.results.every((r) => r.district === "Kadıköy")).toBe(true);
    expect(Object.keys(body.results[0])).toEqual(EXPORT_COLUMNS);
    expect(body.results[0].open_issues_count).toBeNull();
  });

  it("an empty selection still downloads a header-only CSV", async () => {
    const { adapter } = liveAdapter(() => new Response(EXPORT_CSV_EMPTY, { headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    const text = new TextDecoder().decode(await (await adapter.fetchExport(query, "csv")).body.arrayBuffer());
    expect(text.trim()).toBe(EXPORT_COLUMNS.join(","));
  });

  it("export errors give a Turkish reason and say no file was created", () => {
    expect(exportErrorMessage("csv", { status: 403 })).toMatch(/yönetici yetkisi/);
    expect(exportErrorMessage("json", { status: 401 })).toMatch(/yeniden giriş/i);
    expect(exportErrorMessage("csv", { status: 503 })).toMatch(/Hiçbir dosya oluşturulmadı/);
    expect(exportErrorMessage("csv", { status: 501 })).toMatch(/henüz/);
  });
});
