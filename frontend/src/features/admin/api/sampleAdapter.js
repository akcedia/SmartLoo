// SAMPLE DATA ADAPTER — not connected to the backend.
// Facility names, scores and dates below are invented for UI review and are
// labelled as sample data on screen. Replace with httpAdapter once
// /api/v1/admin/metrics/summary and /analytics/export are implemented.

import { AdminApiError } from "./contract.js";
import { addDays, todayInIstanbul, validateRange } from "./dateRange.js";
import { buildExportRows, buildSummary, exportFilename, toCsv } from "./metrics.js";

export const IS_SAMPLE = true;

// Scenarios let reviewers see every screen state without a backend.
export const SCENARIOS = {
  normal: "Normal yanıt",
  slow: "Yavaş yanıt (yükleniyor)",
  error: "Sunucu hatası (500)",
  unauthorized: "Oturum yok (401)",
  forbidden: "Yetkisiz rol (403)",
};

// Demo session shown in the header for each scenario. Not authentication.
export function sampleSessionFor(scenario) {
  if (scenario === "unauthorized") return null;
  if (scenario === "forbidden") return { displayName: "Örnek Kullanıcı", role: "USER", isSample: true };
  return { displayName: "Örnek Yönetici", role: "ADMIN", isSample: true };
}

const F = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function createSampleDataset(today = todayInIstanbul()) {
  const at = (daysAgo, hour = 12) => `${addDays(today, -daysAgo)}T${String(hour).padStart(2, "0")}:00:00+03:00`;
  const facilities = [
    { facility_id: F(1), name: "Örnek Tesis — Moda Sahil", district: "Kadıköy", status: "ACTIVE", open_issues_count: 2, last_cleaned_at: at(1, 8) },
    { facility_id: F(2), name: "Örnek Tesis — İskele", district: "Kadıköy", status: "MAINTENANCE", open_issues_count: null, last_cleaned_at: null },
    { facility_id: F(3), name: "Örnek Tesis — Meydan", district: "Beşiktaş", status: "ACTIVE", open_issues_count: null, last_cleaned_at: null },
    { facility_id: F(4), name: "Örnek Tesis — Park", district: "Beşiktaş", status: "CLOSED", open_issues_count: 0, last_cleaned_at: at(20, 9) },
    { facility_id: F(5), name: "Örnek Tesis — Sahil Yolu", district: "Üsküdar", status: "ACTIVE", open_issues_count: null, last_cleaned_at: null },
  ];
  const scores = [
    [1, 2, 4], [1, 5, 5], [1, 9, 4], [1, 15, 5], [1, 26, 3], [1, 40, 5],
    [2, 3, 2], [2, 6, 3], [2, 12, 2],
    [3, 1, 5], [3, 4, 4], [3, 8, 5], [3, 18, 4], [3, 25, 5],
    [4, 33, 1], [4, 45, 2],
  ];
  const reviews = scores.map(([f, daysAgo, score], i) => ({
    review_id: `sample-${i + 1}`,
    facility_id: F(f),
    cleanliness_score: score,
    created_at: at(daysAgo, 10 + (i % 8)),
  }));
  // Üsküdar intentionally has no reviews: it demonstrates the no-data state.
  return { facilities, reviews };
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

async function respond(scenario, signal) {
  await wait(scenario === "slow" ? 2500 : 300, signal);
  if (scenario === "error") throw new AdminApiError(500, "Sunucu hatası");
  if (scenario === "unauthorized") throw new AdminApiError(401, "Oturum bulunamadı");
  if (scenario === "forbidden") throw new AdminApiError(403, "Bu işlem için yönetici yetkisi gerekir");
}

function validate(filters) {
  const errors = validateRange(filters);
  if (Object.keys(errors).length) throw new AdminApiError(422, "Geçersiz filtre", errors);
}

export function createSampleAdapter({ dataset = createSampleDataset(), getScenario = () => "normal" } = {}) {
  return {
    isSample: IS_SAMPLE,

    async fetchSummary(filters, { signal } = {}) {
      await respond(getScenario(), signal);
      validate(filters);
      return buildSummary(dataset, filters);
    },

    async fetchExport(filters, format, { signal } = {}) {
      await respond(getScenario(), signal);
      validate(filters);
      const rows = buildExportRows(dataset, filters);
      const filename = exportFilename(filters, format);
      if (format === "csv") {
        return { filename, mimeType: "text/csv;charset=utf-8", body: toCsv(rows) };
      }
      const body = JSON.stringify({ filters: { ...filters, timezone: "Europe/Istanbul" }, count: rows.length, results: rows }, null, 2);
      return { filename, mimeType: "application/json", body };
    },
  };
}
