import React from "react";
import { fakeJwt } from "../../shared/session/testJwt.js";
const sharedToken = (sub, role = "USER") => fakeJwt({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 });
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";
import AiSummaryBox from "./AiSummaryBox.jsx";
import FacilityDetailPanel from "./FacilityDetailPanel.jsx";
import ReviewSection from "./ReviewSection.jsx";
import {
  ApiError,
  createToiletReview,
  deleteReview,
  fetchAiRecommendations,
  fetchNearbyToilets,
  fetchToiletAiSummary,
  fetchToiletDetail,
  getCurrentSessionUser,
  updateReview,
} from "./toiletApi.js";

function createMockSessionStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("toiletApi unit & contract tests", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it("maps nearby filters and 3-state pricing parameters accurately", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 1, results: [{ id: 1, name: "Kadıköy İskele" }] }),
    });

    await fetchNearbyToilets({
      lat: 41.0,
      lon: 29.0,
      radius: 1000,
      filters: {
        open_now: true,
        has_disabled_access: true,
        has_baby_changing: false,
        pricing: "free",
      },
    });

    const [calledUrl] = globalThis.fetch.mock.calls[0];
    expect(calledUrl).toContain("/api/v1/toilets/nearby?");
    expect(calledUrl).toContain("open_now=true");
    expect(calledUrl).toContain("has_disabled_access=true");
    expect(calledUrl).toContain("is_free=true");
    expect(calledUrl).not.toContain("has_baby_changing");

    await fetchNearbyToilets({
      lat: 41.0,
      lon: 29.0,
      radius: 1000,
      filters: { open_now: false, has_disabled_access: false, has_baby_changing: false, pricing: "all" },
    });
    const [secondUrl] = globalThis.fetch.mock.calls[1];
    expect(secondUrl).not.toContain("is_free=");
  });

  it("fetches single facility detail and throws ApiError(404) when missing", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: "Moda Sahil WC", district: "Kadıköy" }),
    });

    const detail = await fetchToiletDetail(42);
    expect(detail.district).toBe("Kadıköy");
    expect(globalThis.fetch.mock.calls[0][0]).toBe("/api/v1/toilets/42");

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Facility not found" }),
    });

    await expect(fetchToiletDetail(999)).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });

  it("reads session user from sessionStorage and sends Bearer token for review CRUD", async () => {
    const storage = createMockSessionStorage({
      "smartloo.session": JSON.stringify({ token: sharedToken("user-7"), email: "furkan@smartloo.local" }),
    });
    globalThis.window = { sessionStorage: storage, location: { pathname: "/", search: "" } };

    const user = getCurrentSessionUser();
    expect(user).toEqual({
      id: "user-7",
      role: "USER",
      email: "furkan@smartloo.local",
      displayName: "",
    });

    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 10, cleanliness_score: 5, comment: "Çok temiz" }),
    });

    await createToiletReview(5, { cleanliness_score: 5, comment: "  Çok temiz  " });
    const [postUrl, postOpts] = globalThis.fetch.mock.calls[0];
    expect(postUrl).toBe("/api/v1/toilets/5/reviews");
    expect(postOpts.method).toBe("POST");
    expect(postOpts.headers.Authorization).toBe(`Bearer ${JSON.parse(storage.getItem("smartloo.session")).token}`);
    expect(JSON.parse(postOpts.body)).toEqual({ cleanliness_score: 5, comment: "Çok temiz" });

    await updateReview(10, { cleanliness_score: 4, comment: "Güncellendi" });
    expect(globalThis.fetch.mock.calls[1][0]).toBe("/api/v1/reviews/10");
    expect(globalThis.fetch.mock.calls[1][1].method).toBe("PATCH");

    globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 204 });
    await deleteReview(10);
    expect(globalThis.fetch.mock.calls[2][0]).toBe("/api/v1/reviews/10");
    expect(globalThis.fetch.mock.calls[2][1].method).toBe("DELETE");
  });

  it("extracts 422 field validation errors into ApiError", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [{ loc: ["body", "cleanliness_score"], msg: "Score must be between 1 and 5" }],
      }),
    });

    try {
      await createToiletReview(5, { cleanliness_score: 9, comment: "" });
      throw new Error("Expected ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(422);
      expect(err.fieldErrors.cleanliness_score).toBe("Score must be between 1 and 5");
    }
  });

  it("fetches AI summary and caps AI recommendations to at most 3 items", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ summary: "Genel olarak temiz.", recommendation: "recommended" }),
    });

    const summary = await fetchToiletAiSummary(3);
    expect(summary.recommendation).toBe("recommended");
    expect(globalThis.fetch.mock.calls[0][0]).toBe("/api/v1/toilets/3/summary");

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: 1, name: "Tesis 1" },
          { id: 2, name: "Tesis 2" },
          { id: 3, name: "Tesis 3" },
          { id: 4, name: "Tesis 4" },
        ],
      }),
    });

    const recs = await fetchAiRecommendations({
      lat: 41.0,
      lon: 29.0,
      filters: { open_now: true, pricing: "free" },
    });
    expect(recs.items).toHaveLength(3);
  });
});

describe("Map detail, review and AI components static render tests", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("FacilityDetailPanel renders loading, 404, error and honest null states", () => {
    const baseToilet = {
      id: 12,
      name: "Beşiktaş İskele WC",
      distance_m: 145,
      is_open_now: null,
      has_disabled_access: true,
      has_baby_changing: null,
      is_free: false,
      average_cleanliness: null,
    };

    const loadingHtml = renderToStaticMarkup(
      <FacilityDetailPanel
        selectedToilet={baseToilet}
        loading={true}
        hasLocationPermission={true}
      />
    );
    expect(loadingHtml).toContain("Tesis detayları yükleniyor...");
    expect(loadingHtml).toContain("145 m");
    expect(loadingHtml).toContain("Bilinmiyor");
    expect(loadingHtml).toContain("Henüz puanlanmamış");

    const noPermHtml = renderToStaticMarkup(
      <FacilityDetailPanel
        selectedToilet={baseToilet}
        loading={false}
        hasLocationPermission={false}
      />
    );
    expect(noPermHtml).not.toContain("Kullanıcı Mesafesi:");

    const notFoundHtml = renderToStaticMarkup(
      <FacilityDetailPanel selectedToilet={baseToilet} notFound={true} />
    );
    expect(notFoundHtml).toContain("404");
    expect(notFoundHtml).not.toContain("Hijyen Puanı:");

    const errorHtml = renderToStaticMarkup(
      <FacilityDetailPanel
        selectedToilet={baseToilet}
        error="Detay alınamadı"
        onRetry={() => {}}
      />
    );
    expect(errorHtml).toContain("Detay alınamadı");
    expect(errorHtml).toContain("Yeniden Dene");
  });

  it("ReviewSection shows sign-in CTA for guests and review form for authenticated users", () => {
    const guestHtml = renderToStaticMarkup(<ReviewSection toiletId={12} />);
    expect(guestHtml).toContain("Giriş Yap");
    expect(guestHtml).not.toContain("Yeni Değerlendirme Yaz");

    globalThis.window = {
      sessionStorage: createMockSessionStorage({
        "smartloo.session": JSON.stringify({ token: sharedToken("u-1"), email: "u1@smartloo.local" }),
      }),
      location: { pathname: "/", search: "" },
    };

    const authHtml = renderToStaticMarkup(<ReviewSection toiletId={12} />);
    expect(authHtml).toContain("Yeni Değerlendirme Yaz");
    expect(authHtml).toContain('maxLength="1000"');
  });

  it("AiSummaryBox and AiRecommendationsPanel render accessible sections and guest prompts", () => {
    const summaryHtml = renderToStaticMarkup(<AiSummaryBox toiletId={12} />);
    expect(summaryHtml).toContain("Yapay Zeka Özeti");

    const closedRecHtml = renderToStaticMarkup(
      <AiRecommendationsPanel isOpen={false} searchCenter={{ lat: 41, lon: 29 }} filters={{}} />
    );
    expect(closedRecHtml).toBe("");

    const openGuestRecHtml = renderToStaticMarkup(
      <AiRecommendationsPanel isOpen={true} searchCenter={{ lat: 41, lon: 29 }} filters={{}} />
    );
    expect(openGuestRecHtml).toContain("AI Tesis Önerileri (En Fazla 3)");
    expect(openGuestRecHtml).toContain("Giriş Yap");
  });

  it("supports shared smartloo.session JWT payload and expired token invalidation", () => {
    const encodePayload = (obj) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const validExp = Math.floor(Date.now() / 1000) + 3600;
    const validJwt = `header.${encodePayload({
      sub: "42",
      role: "user",
      email: "onur.shared@smartloo.local",
      exp: validExp,
    })}.sig`;

    const storage = createMockSessionStorage({
      "smartloo.session": JSON.stringify({
        token: validJwt,
        email: "onur.shared@smartloo.local",
      }),
    });
    globalThis.window = { sessionStorage: storage, location: { pathname: "/", search: "" } };

    expect(getCurrentSessionUser()).toEqual({
      id: "42",
      role: "USER",
      email: "onur.shared@smartloo.local",
      displayName: "",
    });

    const expiredJwt = `header.${encodePayload({
      sub: "42",
      role: "USER",
      exp: Math.floor(Date.now() / 1000) - 60,
    })}.sig`;
    storage.setItem("smartloo.session", JSON.stringify({ token: expiredJwt }));

    expect(getCurrentSessionUser()).toBeNull();
    expect(storage.getItem("smartloo.session")).toBeNull();
  });
});;
