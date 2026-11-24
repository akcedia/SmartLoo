// @vitest-environment jsdom
// Real React -> shared auth client -> FastAPI -> private PostgreSQL/MongoDB.
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import AdminRoute from "../AdminRoute.jsx";
import AdminFacilityStatus from "../../map/AdminFacilityStatus.jsx";
import SuggestionPage from "../../suggestions/SuggestionPage.jsx";
import { SessionProvider } from "../../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../../shared/session/sessionStore.js";
import { MapApiProvider } from "../../map/MapApiProvider.jsx";

it("moderates through real services, retains a conflict notice and closes without losing reviews", async () => {
  const env = process.env;
  if (!env.SMARTLOO_LIVE_ORIGIN || !env.SMARTLOO_LIVE_SUGGESTIONS) throw new Error("Use --suite moderation");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const ids = env.SMARTLOO_LIVE_SUGGESTIONS.split(",");
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const requests = [];
  const fetchImpl = (path, options) => { requests.push({ path, method: options?.method }); return fetch(env.SMARTLOO_LIVE_ORIGIN + path, options); };
  const api = (path, role = "ADMIN", method = "GET", body) => fetch(env.SMARTLOO_LIVE_ORIGIN + path, {
    method, headers: { Authorization: `Bearer ${env[`SMARTLOO_LIVE_${role}`]}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const settle = async (predicate) => {
    for (let i = 0; i < 240; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
      if (predicate()) return;
    }
    throw new Error("Mounted moderation did not settle: " + host.textContent);
  };
  const button = (label, within = host) => [...within.querySelectorAll("button")].find((b) => b.textContent === label);
  const mount = async (role, child) => act(async () => root.render(
    <SessionProvider key={role} initialSession={sessionFromToken(env[`SMARTLOO_LIVE_${role}`], env[`SMARTLOO_LIVE_${role}_EMAIL`])} fetchImpl={fetchImpl}>
      <MapApiProvider>{child}</MapApiProvider>
    </SessionProvider>));
  const card = (name) => [...host.querySelectorAll(".admin-mod-item")].find((node) => node.textContent.includes(name));
  function StatusHarness() {
    const [status, setStatus] = useState("ACTIVE");
    return <AdminFacilityStatus toiletId={ids[0]} status={status} onChanged={async () => {
      const detail = await (await api(`/api/v1/toilets/${ids[0]}`)).json(); setStatus(detail.status);
    }} />;
  }
  try {
    expect((await fetch(env.SMARTLOO_LIVE_ORIGIN + "/api/v1/admin/suggestions")).status).toBe(401);
    expect((await api("/api/v1/admin/suggestions", "OWNER")).status).toBe(403);
    await mount("ADMIN", <AdminRoute path="/admin/moderation" mode="live" />);
    await settle(() => host.querySelectorAll(".admin-mod-item").length === 3);
    await act(async () => button("Onayla", card("Approve")).click());
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
    await act(async () => button("Evet, onayla", card("Approve")).click());
    await settle(() => !card("Approve"));
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
    const approved = await (await api(`/api/v1/toilets/${ids[0]}`)).json();
    expect(approved).toMatchObject({ status: "ACTIVE", is_free: null, has_baby_changing: null, has_disabled_access: null, opening_hours: null });
    const nearby = await (await api("/api/v1/toilets/nearby?lat=41&lon=29&radius=5000")).json();
    expect(nearby.results.some((row) => row.id === ids[0])).toBe(true);
    await act(async () => button("Reddet", card("Reject")).click());
    await act(async () => button("Evet, reddet", card("Reject")).click());
    await settle(() => !card("Reject"));
    expect((await api(`/api/v1/toilets/${ids[1]}`)).status).toBe(404);
    expect((await api(`/api/v1/admin/suggestions/${ids[2]}`, "ADMIN", "PATCH", { status: "approved" })).status).toBe(200);
    await act(async () => button("Reddet", card("Conflict")).click());
    await act(async () => button("Evet, reddet", card("Conflict")).click());
    await settle(() => !card("Conflict") && host.textContent.includes("Bekleyen öneri yok."));
    expect(host.querySelector('[role="alert"]').textContent).toContain("zaten karara bağlanmış");
    expect((await api(`/api/v1/toilets/${ids[0]}/reviews`, "OWNER", "POST", { cleanliness_score: 4, comment: "Temizdi." })).status).toBe(201);
    await mount("OWNER", <StatusHarness />);
    expect(host.querySelector(".sl-admin-status")).toBeNull();
    await mount("ADMIN", <StatusHarness />);
    await act(async () => button("Kapalı").click());
    await act(async () => button("“Kapalı” yap").click());
    await settle(() => button("Kapalı").getAttribute("aria-checked") === "true");
    const closed = await (await api(`/api/v1/toilets/${ids[0]}`)).json();
    expect(closed).toMatchObject({ status: "CLOSED", review_count: 1, average_cleanliness: 4 });
    expect((await (await api(`/api/v1/toilets/${ids[0]}/reviews`)).json()).count).toBe(1);
    expect((await api(`/api/v1/toilets/${ids[0]}/reviews`, "OTHER", "POST", { cleanliness_score: 2 })).status).toBe(404);
    // Actual USER form -> HTTP 202 pending -> ADMIN approval -> public facility.
    await mount("OWNER", <SuggestionPage />);
    for (const [name,value] of Object.entries({ name:env.SMARTLOO_LIVE_SUGGESTION_NAME,
      district:"Kadıköy", latitude:"41.0005", longitude:"29" })) {
      await act(async () => {
        const input = host.querySelector(`[name="${name}"]`);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);
        input.dispatchEvent(new Event("input", {bubbles:true}));
      });
    }
    await act(async () => button("Öneriyi gönder").click());
    await settle(() => host.textContent.includes("Henüz haritada yayımlanmadı"));
    expect(requests.filter(r => r.path === "/api/v1/toilets/suggest" && r.method === "POST")).toHaveLength(1);
    const pending = await (await api("/api/v1/admin/suggestions?status=pending")).json();
    const formRow = pending.results.find(row => row.name === env.SMARTLOO_LIVE_SUGGESTION_NAME);
    expect(formRow).toMatchObject({status:"pending",has_disabled_access:null,has_baby_changing:null,is_free:null});
    const beforeApproval = await (await api("/api/v1/toilets/nearby?lat=41&lon=29&radius=5000")).json();
    expect(beforeApproval.results.some(row => row.id === formRow.id)).toBe(false);
    await mount("ADMIN", <AdminRoute path="/admin/moderation" mode="live" />);
    await settle(() => Boolean(card(env.SMARTLOO_LIVE_SUGGESTION_NAME)));
    await act(async () => button("Onayla",card(env.SMARTLOO_LIVE_SUGGESTION_NAME)).click());
    await act(async () => button("Evet, onayla",card(env.SMARTLOO_LIVE_SUGGESTION_NAME)).click());
    await settle(() => !card(env.SMARTLOO_LIVE_SUGGESTION_NAME));
    expect((await api(`/api/v1/toilets/${formRow.id}`)).status).toBe(200);
  } finally {
    await act(async () => root.unmount()); host.remove();
  }
}, 20000);
