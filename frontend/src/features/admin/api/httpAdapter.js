// Live adapter for the admin analytics endpoints, built on the shared API client
// (Bearer token, 401 session handling). The backend enforces ADMIN (401/403).

import { EXPORT_PATH, SUMMARY_PATH } from "./contract.js";

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

    fetchSummary(filters, { signal } = {}) {
      return client.request(SUMMARY_PATH, { query: queryParams(filters), signal });
    },

    // Error statuses throw before a file is created, so an error body is never saved as a report.
    async fetchExport(filters, format, { signal } = {}) {
      const res = await client.request(EXPORT_PATH, { query: queryParams(filters, format), signal, raw: true });
      return {
        filename: filenameFrom(res.headers.get("Content-Disposition"), `smartloo-hygiene.${format}`),
        mimeType: res.headers.get("Content-Type") ?? "application/octet-stream",
        body: await res.blob(),
      };
    },
  };
}
