// HTTP adapter for the real admin analytics endpoints.
// NOT WIRED IN YET: both endpoints still return 501 and auth (#23/#24 follow-ups)
// does not issue tokens. Kept here so the request shape is reviewed together
// with docs/contracts/admin-analytics-api.md.

import { AdminApiError, EXPORT_PATH, SUMMARY_PATH } from "./contract.js";

export function buildQuery({ district, from, to }, format) {
  const params = new URLSearchParams();
  if (format) params.set("format", format);
  if (district) params.set("district", district);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params.toString();
}

async function request(baseUrl, path, query, getToken, signal) {
  const token = getToken?.();
  const response = await fetch(`${baseUrl}${path}?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok) {
    let detail = null;
    try {
      detail = (await response.json()).detail ?? null;
    } catch {
      // Non-JSON error body.
    }
    throw new AdminApiError(response.status, response.statusText || "İstek başarısız", detail);
  }
  return response;
}

function filenameFrom(response, fallback) {
  const match = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") ?? "");
  return match ? match[1] : fallback;
}

export function createHttpAdapter({ baseUrl = "", getToken }) {
  return {
    isSample: false,

    async fetchSummary(filters, { signal } = {}) {
      const res = await request(baseUrl, SUMMARY_PATH, buildQuery(filters), getToken, signal);
      return res.json();
    },

    async fetchExport(filters, format, { signal } = {}) {
      const res = await request(baseUrl, EXPORT_PATH, buildQuery(filters, format), getToken, signal);
      return {
        filename: filenameFrom(res, `smartloo-hygiene.${format}`),
        mimeType: res.headers.get("Content-Type") ?? "application/octet-stream",
        body: await res.blob(),
      };
    },
  };
}
