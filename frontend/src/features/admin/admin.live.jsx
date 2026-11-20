// Explicit live config only: the runner supplies real services and disposable data.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { createApiClient } from "../../shared/http/apiClient.js";
import { createToiletApi } from "../map/toiletApi.js";
import { createHttpAdapter } from "./api/httpAdapter.js";
import AdminRoute from "./AdminRoute.jsx";

it("live ADMIN panel and both downloads follow real review create/edit/delete", async () => {
  if (!process.env.SMARTLOO_LIVE_ORIGIN) throw new Error("Use scripts/check_map_reviews_live.py --suite analytics");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const origin = process.env.SMARTLOO_LIVE_ORIGIN;
  const facility = process.env.SMARTLOO_LIVE_TOILET;
  const admin = sessionFromToken(process.env.SMARTLOO_LIVE_ADMIN, "admin@example.com");
  const client = createApiClient({ baseUrl: origin, getToken: () => process.env.SMARTLOO_LIVE_OWNER });
  const reviews = createToiletApi(client.request);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const requests = [];
  let adapter;
  function Probe() {
    const { api } = useSession();
    adapter = createHttpAdapter({ client: api });
    return <AdminRoute path="/admin" mode="live" />;
  }
  const fetchImpl = async (path, options) => {
    requests.push(path);
    return fetch(`${origin}${path}`, options);
  };
  const settle = async predicate => {
    for (let n = 0; n < 100; n++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
      if (predicate() && !host.querySelector('[aria-busy="true"]')) return;
    }
    throw new Error(`Panel did not settle: ${host.textContent}`);
  };
  const score = () => host.querySelector(".admin-kpis .admin-card .admin-kpi")?.textContent;
  const filters = () => {
    const dates = host.querySelectorAll('input[type="date"]');
    return { district: "Kadıköy", from: dates[0].value, to: dates[1].value };
  };
  const refresh = async value => {
    await act(async () => host.querySelector(`input[value="${value}"]`).click());
  };
  // jsdom has no download manager. Capture only the anchor filename; bytes are
  // independently checked through the actual HTTP adapter and real responses.
  const filenames = [];
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:test-download";
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { filenames.push(this.download); });
  try {
    await act(async () => root.render(<SessionProvider initialSession={admin} fetchImpl={fetchImpl}><Probe /></SessionProvider>));
    await settle(() => score() === "Veri yok");
    expect(host.textContent).not.toContain("ÖRNEK VERİ");
    await act(async () => {
      const district = host.querySelector("select");
      district.value = "Kadıköy";
      district.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle(() => score() === "Veri yok" && requests.at(-1).includes("district=Kad"));

    const review = await reviews.createToiletReview(facility, { cleanliness_score: 2, comment: "Temizleme gerekli" });
    await refresh("last7");
    await settle(() => score()?.includes("2.00"));
    expect(host.textContent).toContain("Acil Müdahale Gerekli");
    for (const format of ["csv", "json"]) {
      const downloaded = await adapter.fetchExport(filters(), format);
      expect(downloaded.filename).toContain("Kadıköy");
      const text = await downloaded.body.text();
      if (format === "json") {
        const data = JSON.parse(text);
        expect(data.filters.district).toBe("Kadıköy");
        expect(data.results.find(row => row.facility_id === facility).hygiene_score).toBe(2);
      } else {
        expect(text).toContain(facility);
        expect(text).toContain("Kadıköy,2.0,,");
      }
      const button = [...host.querySelectorAll("button")].find(el => el.textContent === `${format.toUpperCase()} dışa aktar`);
      await act(async () => button.click());
      await settle(() => filenames.some(name => name.endsWith(`.${format}`)));
    }
    expect(filenames).toHaveLength(2);
    expect(filenames.every(name => name.includes("Kadıköy"))).toBe(true);

    await reviews.updateReview(review.id, { cleanliness_score: 5, comment: "Güncellendi" });
    await refresh("last30");
    await settle(() => score()?.includes("5.00"));
    expect(host.textContent).not.toContain("Acil Müdahale Gerekli");
    await reviews.deleteReview(review.id);
    await refresh("last7");
    await settle(() => score() === "Veri yok");
    const empty = JSON.parse(await (await adapter.fetchExport(filters(), "json")).body.text());
    expect(empty.results.find(row => row.facility_id === facility).hygiene_score).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  }
}, 30000);
