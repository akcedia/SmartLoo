// Live adapter for the admin analytics endpoints, built on the shared API client
// (Bearer token, 401 session handling). The backend enforces ADMIN (401/403).

import { ApiError } from "../../../shared/http/apiClient.js";
import { CRITICAL_THRESHOLD, EXPORT_PATH, SUMMARY_PATH } from "./contract.js";
import { exportFilename } from "./metrics.js";

const isNullableNumber = (v) => v === null || (typeof v === "number" && Number.isFinite(v));

// Checks the required fields (TC-09/TC-25). Missing proposed lists become null
// ("not provided"), not [] ("none matched"), so a first backend version without
// trend/facilities renders honestly instead of crashing or claiming no facilities.
// Values are never recomputed here: the KPI and alert are the server's.
export function normalizeSummary(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !isNullableNumber(raw.average_cleanliness) ||
    !Number.isInteger(raw.review_count) ||
    typeof raw.critical_alert !== "boolean"
  ) {
    throw new ApiError(502, "Analitik yanıtı sözleşmeye uymuyor");
  }
  return {
    ...raw,
    critical_threshold: typeof raw.critical_threshold === "number" ? raw.critical_threshold : CRITICAL_THRESHOLD,
    active_facility_ratio: raw.active_facility_ratio ?? null,
    trend: Array.isArray(raw.trend) ? raw.trend : null,
    facilities: Array.isArray(raw.facilities) ? raw.facilities : null,
  };
}

export function queryParams({ district, from, to }, format) {
  const params = {};
  if (format) params.format = format;
  if (district) params.district = district;
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

export function buildQuery(filters, format) {
  return new URLSearchParams(queryParams(filters, format)).toString();
}

// HTTP headers cannot carry raw non-ASCII, so a name such as "Kadıköy" arrives as
// RFC 5987 filename*=UTF-8''…; prefer it over the plain ASCII filename.
export function filenameFrom(contentDisposition, fallback) {
  const header = contentDisposition ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Fall through to the plain filename.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

export function createHttpAdapter({ client }) {
  return {
    isSample: false,

    async fetchSummary(filters, { signal } = {}) {
      return normalizeSummary(await client.request(SUMMARY_PATH, { query: queryParams(filters), signal }));
    },

    // Error statuses throw before a file is created, so an error body is never saved as a report.
    async fetchExport(filters, format, { signal } = {}) {
      const res = await client.request(EXPORT_PATH, { query: queryParams(filters, format), signal, raw: true });
      return {
        // Without a Content-Disposition (e.g. JSON today), name the file after the selection like the CSV.
        filename: filenameFrom(res.headers.get("Content-Disposition"), exportFilename(filters, format)),
        mimeType: res.headers.get("Content-Type") ?? "application/octet-stream",
        body: await res.blob(),
      };
    },
  };
}
