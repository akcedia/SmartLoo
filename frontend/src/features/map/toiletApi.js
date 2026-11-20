export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {}, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
  }
}

const SESSION_KEYS = ["smartloo.session", "smartloo_session"];

function readRawSessionObject() {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  for (const key of SESSION_KEYS) {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { key, parsed };
      }
    } catch {
      // Bozuk JSON varsa sonraki anahtara geç
    }
  }
  return null;
}

export function getStoredAccessToken() {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const sessionEntry = readRawSessionObject();
  if (sessionEntry) {
    const { parsed } = sessionEntry;
    const token = parsed?.token || parsed?.accessToken || parsed?.access_token || null;
    if (token) {
      const claims = decodeJwtPayload(token);
      if (claims?.exp && Number(claims.exp) * 1000 <= Date.now()) {
        window.sessionStorage.removeItem(sessionEntry.key);
        return null;
      }
      return token;
    }
  }

  return (
    window.sessionStorage.getItem("smartloo_token") ||
    window.sessionStorage.getItem("access_token") ||
    null
  );
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getCurrentSessionUser() {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const token = getStoredAccessToken();
  if (!token) return null;

  const sessionEntry = readRawSessionObject();
  const parsed = sessionEntry?.parsed || null;
  const storedUser = parsed?.user || parsed || null;

  const claims = decodeJwtPayload(token);
  if (claims?.exp && Number(claims.exp) * 1000 <= Date.now()) {
    return null;
  }

  const id = storedUser?.id || storedUser?.sub || claims?.sub || null;
  if (!id) return null;

  return {
    id: String(id),
    role: String(storedUser?.role || claims?.role || "USER").toUpperCase(),
    email: parsed?.email || storedUser?.email || claims?.email || "",
    displayName: storedUser?.display_name || storedUser?.displayName || "",
  };
}

export function buildSignInUrl(nextPath) {
  const target =
    nextPath ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  return `/sign-in?next=${encodeURIComponent(target)}`;
}

function extractFieldErrors(payload) {
  if (!payload || !Array.isArray(payload.detail)) return {};
  const fieldErrors = {};
  for (const item of payload.detail) {
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const field = loc[loc.length - 1];
    if (field && item.msg) {
      fieldErrors[String(field)] = item.msg;
    }
  }
  return fieldErrors;
}

export async function apiRequest(path, { method = "GET", query, body, auth = true, signal } = {}) {
  let url = path;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += `${url.includes("?") ? "&" : "?"}${queryString}`;
    }
  }

  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getStoredAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message =
      (typeof payload?.detail === "string" && payload.detail) ||
      payload?.message ||
      `API isteği başarısız oldu (HTTP ${response.status})`;

    throw new ApiError(message, {
      status: response.status,
      fieldErrors: response.status === 422 ? extractFieldErrors(payload) : {},
      data: payload,
    });
  }

  if (response.status === 204) return null;
  return await response.json();
}

export async function fetchNearbyToilets({ lat, lon, radius, filters, signal }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
  });

  if (filters.open_now) params.set("open_now", "true");
  if (filters.has_disabled_access) params.set("has_disabled_access", "true");
  if (filters.has_baby_changing) params.set("has_baby_changing", "true");

  // FR-02: "free" -> is_free=true, "paid" -> is_free=false, "all" -> parametre gönderilmez
  if (filters.pricing === "free") {
    params.set("is_free", "true");
  } else if (filters.pricing === "paid") {
    params.set("is_free", "false");
  }

  const response = await fetch(`/api/v1/toilets/nearby?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`API isteği başarısız oldu (HTTP ${response.status})`);
  }

  return await response.json();
}

export async function fetchToiletDetail(toiletId, { signal } = {}) {
  return await apiRequest(`/api/v1/toilets/${encodeURIComponent(toiletId)}`, {
    method: "GET",
    auth: false,
    signal,
  });
}

export async function fetchToiletReviews(toiletId, { signal } = {}) {
  const data = await apiRequest(`/api/v1/toilets/${encodeURIComponent(toiletId)}/reviews`, {
    method: "GET",
    auth: true,
    signal,
  });

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.reviews)) return data.reviews;
  return [];
}

export async function createToiletReview(toiletId, { cleanliness_score, comment }) {
  return await apiRequest(`/api/v1/toilets/${encodeURIComponent(toiletId)}/reviews`, {
    method: "POST",
    auth: true,
    body: {
      cleanliness_score: Number(cleanliness_score),
      comment: comment?.trim() ? comment.trim() : null,
    },
  });
}

export async function updateReview(reviewId, { cleanliness_score, comment }) {
  return await apiRequest(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    auth: true,
    body: {
      cleanliness_score: Number(cleanliness_score),
      comment: comment?.trim() ? comment.trim() : null,
    },
  });
}

export async function deleteReview(reviewId) {
  return await apiRequest(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function fetchToiletAiSummary(toiletId, { signal } = {}) {
  return await apiRequest(`/api/v1/toilets/${encodeURIComponent(toiletId)}/summary`, {
    method: "GET",
    auth: false,
    signal,
  });
}

export async function fetchAiRecommendations({ lat, lon, filters = {}, signal } = {}) {
  const query = {
    lat,
    lon,
  };

  if (filters.open_now) query.open_now = "true";
  if (filters.has_disabled_access) query.has_disabled_access = "true";
  if (filters.has_baby_changing) query.has_baby_changing = "true";
  if (filters.pricing === "free") {
    query.is_free = "true";
  } else if (filters.pricing === "paid") {
    query.is_free = "false";
  }

  const data = await apiRequest("/api/v1/recommendations", {
    method: "GET",
    query,
    auth: true,
    signal,
  });

  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];

  return {
    items: rawItems.slice(0, 3),
    fallback: Boolean(data?.fallback || data?.available === false),
    message: data?.message || data?.reason || "",
  };
} 