// Shared HTTP client for every SmartLoo screen.
// Attaches the session's Bearer token, turns error responses into ApiError
// and reports a rejected token once, so the session can end in one place.

export class ApiError extends Error {
  constructor(status, message, { detail = null, fieldErrors = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
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

async function readDetail(response) {
  try {
    return (await response.json()).detail ?? null;
  } catch {
    return null;
  }
}

export function createApiClient({ baseUrl = "", getToken = () => null, onUnauthorized = () => {}, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));

  async function request(path, { method = "GET", query, body, signal, auth = true, raw = false } = {}) {
    const token = auth ? getToken() : null;
    const headers = { Accept: raw ? "*/*" : "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== null && v !== undefined && v !== "")).toString() : "";
    let response;
    try {
      response = await doFetch(`${baseUrl}${path}${qs ? `?${qs}` : ""}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError(0, "Sunucuya ulaşılamadı");
    }

    if (!response.ok) {
      const detail = await readDetail(response);
      // Only a token we actually sent can have expired; a sign-in failure is not a session end.
      if (response.status === 401 && token) onUnauthorized();
      const message = typeof detail === "string" ? detail : response.statusText || "İstek başarısız";
      throw new ApiError(response.status, message, { detail, fieldErrors: fieldErrorsFrom(detail) });
    }

    if (raw) return response;
    if (response.status === 204) return null;
    return response.json();
  }

  return { request };
}
