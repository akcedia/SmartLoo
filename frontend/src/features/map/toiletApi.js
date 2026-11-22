import { createApiClient } from "../../shared/http/apiClient.js";
import { loadSession } from "../../shared/session/sessionStore.js";
export { ApiError } from "../../shared/http/apiClient.js";

export function getStoredAccessToken() {
  return loadSession()?.token ?? null;
}

export function getCurrentSessionUser() {
  const session = loadSession();
  return session ? { id: session.userId, role: session.role.toUpperCase(), email: session.email, displayName: "" } : null;
}

export function buildSignInUrl(nextPath) {
  const target =
    nextPath ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  return `/sign-in?next=${encodeURIComponent(target)}`;
}

// Standalone callers use the same HTTP/error parser. The application injects
// SessionProvider's client through MapApiProvider so 401 ends the shared session.
export const apiRequest = createApiClient({ getToken: getStoredAccessToken }).request;

export function createToiletApi(request = apiRequest) {
  async function fetchIbbToilets({ filters, signal }) {
    const query = {};
    for (const field of ["open_now", "has_disabled_access", "has_baby_changing"]) {
      if (filters[field]) query[field] = true;
    }
    if (filters.pricing !== "all") query.is_free = filters.pricing === "free";
    return request("/api/v1/toilets", { query, auth: false, signal });
  }
  async function fetchNearbyToilets({ lat, lon, radius, filters, signal }) {
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

    return request("/api/v1/toilets/nearby", {
      query: Object.fromEntries(params), auth: false, signal,
    });
  }

  async function fetchToiletDetail(toiletId, { signal } = {}) {
    return await request(`/api/v1/toilets/${encodeURIComponent(toiletId)}`, {
      method: "GET",
      auth: false,
      signal,
    });
  }

  async function fetchToiletReviews(toiletId, { signal } = {}) {
    const data = await request(`/api/v1/toilets/${encodeURIComponent(toiletId)}/reviews`, {
      method: "GET",
      auth: true,
      signal,
    });

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.reviews)) return data.reviews;
    return [];
  }

  async function createToiletReview(toiletId, { cleanliness_score, comment }) {
    return await request(`/api/v1/toilets/${encodeURIComponent(toiletId)}/reviews`, {
      method: "POST",
      auth: true,
      body: {
        cleanliness_score: Number(cleanliness_score),
        comment: comment?.trim() ? comment.trim() : null,
      },
    });
  }

  async function updateReview(reviewId, { cleanliness_score, comment }) {
    return await request(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
      method: "PATCH",
      auth: true,
      body: {
        cleanliness_score: Number(cleanliness_score),
        comment: comment?.trim() ? comment.trim() : null,
      },
    });
  }

  async function deleteReview(reviewId) {
    return await request(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async function fetchToiletAiSummary(toiletId, { signal } = {}) {
    return await request(`/api/v1/toilets/${encodeURIComponent(toiletId)}/summary`, {
      method: "GET",
      auth: false,
      signal,
    });
  }

  async function fetchAiRecommendations({ lat, lon, radius = 1000, filters = {}, signal } = {}) {
    const query = {
      lat,
      lon,
      radius,
    };

    if (filters.open_now) query.open_now = "true";
    if (filters.has_disabled_access) query.has_disabled_access = "true";
    if (filters.has_baby_changing) query.has_baby_changing = "true";
    if (filters.pricing === "free") {
      query.is_free = "true";
    } else if (filters.pricing === "paid") {
      query.is_free = "false";
    }

    const data = await request("/api/v1/recommendations", {
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
      aiReasonsAvailable: data?.ai_reasons_available === true,
    };
  }
  return { fetchIbbToilets, fetchNearbyToilets, fetchToiletDetail, fetchToiletReviews, createToiletReview, updateReview, deleteReview, fetchToiletAiSummary, fetchAiRecommendations };
}

export const { fetchNearbyToilets, fetchToiletDetail, fetchToiletReviews, createToiletReview, updateReview, deleteReview, fetchToiletAiSummary, fetchAiRecommendations } = createToiletApi();
