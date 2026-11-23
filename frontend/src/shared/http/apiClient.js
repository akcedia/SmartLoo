// Shared HTTP client for every SmartLoo screen.
// Attaches the session's Bearer token, turns error responses into ApiError
// and reports a rejected token once, so the session can end in one place.

export class ApiError extends Error {
  constructor(status, message, { detail = null, fieldErrors = {}, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
    // Whole parsed error body, for APIs that answer with top-level fields (e.g. import 422 `errors`).
    this.data = data;
  }
}

// FastAPI validation errors: [{ loc: ["body", "email"], msg: "..." }, ...]
export function fieldErrorsFrom(detail) {
  if (!Array.isArray(detail)) return {};
  const errors = {};
  for (const item of detail) {
    const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
    if (typeof field === "string" && !errors[field]) {
      errors[field] = String(item.msg ?? "Geçersiz değer").replace(/^Value error, /, "");
    }
  }
  return errors;
}

async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createApiClient({ baseUrl = "", getToken = () => null, onUnauthorized = () => {}, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));

  // `body` is sent as JSON. `rawBody` (string, Blob/File, ArrayBuffer) is sent unchanged with
  // `contentType`, e.g. a CSV file as text/csv; it is never JSON-stringified.
  async function request(path, { method = "GET", query, body, rawBody, contentType, signal, auth = true, raw = false } = {}) {
    const token = auth ? getToken() : null;
    const headers = { Accept: raw ? "*/*" : "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rawBody !== undefined) headers["Content-Type"] = contentType ?? "application/octet-stream";
    else if (body !== undefined) headers["Content-Type"] = "application/json";

    const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== null && v !== undefined && v !== "")).toString() : "";
    let response;
    try {
      response = await doFetch(`${baseUrl}${path}${qs ? `?${qs}` : ""}`, {
        method,
        headers,
        body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError(0, "Sunucuya ulaşılamadı");
    }

    if (!response.ok) {
      const data = await readErrorBody(response);
      const detail = data && typeof data === "object" && "detail" in data ? data.detail : null;
      // Only a token we actually sent can have expired; a sign-in failure is not a session end.
      if (response.status === 401 && token) onUnauthorized();
      const message = typeof detail === "string" ? detail : response.statusText || "İstek başarısız";
      throw new ApiError(response.status, message, { detail, fieldErrors: fieldErrorsFrom(detail), data });
    }

    if (raw) return response;
    if (response.status === 204) return null;
    return response.json();
  }

  return { request };
}
