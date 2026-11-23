// @vitest-environment jsdom
// FR-05 moderation screen and FR-10 facility status, with a scripted server.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiClient } from "../../../shared/http/apiClient.js";
import ModerationPanel from "./ModerationPanel.jsx";
import AdminFacilityStatus from "../../map/AdminFacilityStatus.jsx";
import { MapApiProvider } from "../../map/MapApiProvider.jsx";
import { SessionProvider } from "../../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../../shared/session/sessionStore.js";
import { fakeJwt } from "../../../shared/session/testJwt.js";
import { adminSection } from "../AdminRoute.jsx";

const suggestion = (n, extra = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  status: "pending",
  name: `Öneri ${n}`,
  district: "Kadıköy",
  latitude: 40.98,
  longitude: 29.02,
  has_disabled_access: true,
  has_baby_changing: null,
  is_free: false,
  toilet_id: null,
  created_at: "2026-11-23T09:00:00Z",
  decided_at: null,
  ...extra,
});

let host;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  sessionStorage.clear();
});

function scripted(responses) {
  const calls = [];
  const api = createApiClient({
    getToken: () => "admin-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next(url, init) : next;
    },
  });
  return { api, calls };
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

describe("moderation route", () => {
  it("maps /admin/moderation to its own section", () => {
    expect(adminSection("/admin/moderation")).toBe("moderation");
    expect(adminSection("/admin/import")).toBe("import");
    expect(adminSection("/admin")).toBe("analytics");
  });
});

describe("ModerationPanel", () => {
  it("lists pending suggestions with unknown amenities shown as unknown", async () => {
    const { api, calls } = scripted([Response.json({ count: 1, results: [suggestion(1)] })]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    expect(calls[0].url).toBe("/api/v1/admin/suggestions?status=pending&limit=50&offset=0");
    expect(calls[0].init.headers.Authorization).toBe("Bearer admin-token");
    const card = host.querySelector(".admin-mod-item");
    expect(card.textContent).toContain("Öneri 1");
    expect(card.textContent).toContain("Var"); // disabled access true
    expect(card.textContent).toContain("Bilinmiyor"); // baby changing null
    expect(card.textContent).toContain("Ücretli");
    expect(card.querySelector("a").getAttribute("href")).toContain("openstreetmap.org");
  });

  it("approves only after confirmation, sends one PATCH and removes the card", async () => {
    const { api, calls } = scripted([
      Response.json({ count: 1, results: [suggestion(1)] }),
      Response.json(suggestion(1, { status: "approved", toilet_id: suggestion(1).id, decided_at: "2026-11-24T10:00:00Z" })),
    ]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    await act(async () => button("Onayla").click());
    expect(calls).toHaveLength(1);
    expect(host.textContent).toContain("haritada hemen yayınlanır");
    expect(host.querySelector(".admin-mod-confirm").contains(document.activeElement)).toBe(true);

    await act(async () => button("Evet, onayla").click());
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1].init.method).toBe("PATCH");
    expect(calls[1].url).toBe(`/api/v1/admin/suggestions/${suggestion(1).id}`);
    expect(JSON.parse(calls[1].init.body)).toEqual({ status: "approved" });
    expect(host.querySelector(".admin-mod-item")).toBeNull();
    expect(host.querySelector(".admin-mod-notice").textContent).toContain("onaylandı; tesis haritada yayında");
    expect(host.textContent).toContain("Bekleyen öneri yok.");
  });

  it("Escape cancels the confirmation without sending anything", async () => {
    const { api, calls } = scripted([Response.json({ count: 1, results: [suggestion(1)] })]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    await act(async () => button("Reddet").click());
    const box = host.querySelector(".admin-mod-confirm");
    await act(async () => box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector(".admin-mod-confirm")).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("a 409 (already decided elsewhere) explains it and reloads the list", async () => {
    const { api, calls } = scripted([
      Response.json({ count: 1, results: [suggestion(1)] }),
      Response.json({ detail: "Suggestion has already been decided" }, { status: 409 }),
      Response.json({ count: 0, results: [] }),
    ]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    await act(async () => button("Reddet").click());
    await act(async () => button("Evet, reddet").click());
    await settle();
    expect(calls).toHaveLength(3);
    expect(calls[2].url).toContain("status=pending");
    expect(host.textContent).toContain("Bekleyen öneri yok.");
  });

  it("switches status lists and pages with 'Daha fazla göster'", async () => {
    const first = Array.from({ length: 2 }, (_, i) => suggestion(i + 1, { status: "rejected", decided_at: "2026-11-24T10:00:00Z" }));
    const { api, calls } = scripted([
      Response.json({ count: 0, results: [] }),
      Response.json({ count: 3, results: first }),
      Response.json({ count: 3, results: [suggestion(3, { status: "rejected" })] }),
    ]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    await act(async () => [...host.querySelectorAll('[role="radio"]')].find((b) => b.textContent === "Reddedilen").click());
    await settle();
    expect(calls[1].url).toContain("status=rejected");
    expect(host.querySelectorAll(".admin-mod-item")).toHaveLength(2);
    expect(button("Onayla")).toBeUndefined();
    await act(async () => button("Daha fazla göster (1 kaldı)").click());
    await settle();
    expect(calls[2].url).toContain("offset=2");
    expect(host.querySelectorAll(".admin-mod-item")).toHaveLength(3);
  });

  it("shows list errors with a retry and refuses bodies that break the contract", async () => {
    const { api } = scripted([
      Response.json({ detail: "x" }, { status: 503 }),
      Response.json({ items: [] }),
    ]);
    await act(async () => root.render(<ModerationPanel api={api} />));
    await settle();
    expect(host.querySelector('[role="alert"]').textContent).toContain("Öneriler alınamadı");
    await act(async () => button("Tekrar dene").click());
    await settle();
    expect(host.querySelector('[role="alert"]').textContent).toContain("Öneriler alınamadı");
  });
});

describe("AdminFacilityStatus", () => {
  const TOILET = "11111111-1111-4111-8111-111111111111";

  async function renderAs(role, fetchImpl, status = "ACTIVE") {
    const session = sessionFromToken(fakeJwt({ role, sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }), "a@b.co");
    let changed = 0;
    await act(async () =>
      root.render(
        <SessionProvider initialSession={session} fetchImpl={fetchImpl}>
          <MapApiProvider>
            <AdminFacilityStatus toiletId={TOILET} status={status} onChanged={() => { changed += 1; }} />
          </MapApiProvider>
        </SessionProvider>,
      ),
    );
    return () => changed;
  }

  it("is not shown to a USER or a guest", async () => {
    await renderAs("USER", async () => Response.json({}));
    expect(host.querySelector(".sl-admin-status")).toBeNull();
  });

  it("closes a facility only after confirmation and reports the saved status", async () => {
    const calls = [];
    const changed = await renderAs("ADMIN", async (url, init) => {
      calls.push({ url, init });
      return Response.json({ id: TOILET, status: "CLOSED", review_version: 4 });
    });
    const radios = [...host.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(["Aktif", "Bakımda", "Kapalı"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    await act(async () => radios[2].click());
    expect(calls).toHaveLength(0);
    expect(host.textContent).toContain("yorumlar ve puanlar korunur");
    await act(async () => button("“Kapalı” yap").click());
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/api/v1/admin/toilets/${TOILET}`);
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(calls[0].init.body)).toEqual({ status: "CLOSED" });
    expect(host.querySelector('[role="status"]').textContent).toBe("Tesis durumu “Kapalı” olarak kaydedildi.");
    expect(changed()).toBe(1);
  });

  it("a 503 says nothing changed and refreshes the details", async () => {
    const changed = await renderAs("ADMIN", async () => Response.json({ detail: "busy" }, { status: 503 }));
    await act(async () => [...host.querySelectorAll('[role="radio"]')][1].click());
    await act(async () => button("“Bakımda” yap").click());
    await settle();
    expect(host.querySelector('[role="alert"]').textContent).toContain("süren bir yorum işlemi var");
    expect(changed()).toBe(1);
  });
});
