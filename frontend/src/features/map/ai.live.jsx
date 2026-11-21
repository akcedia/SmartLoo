import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { MapApiProvider } from "./MapApiProvider.jsx";
import AiSummaryBox from "./AiSummaryBox.jsx";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";

const origin = process.env.SMARTLOO_LIVE_ORIGIN;
const facility = process.env.SMARTLOO_LIVE_TOILET;
let host, root;
const fetchImpl = (path, init) => fetch(`${origin}${path}`, init);
const filters = { pricing: "all" };
const current = () => sessionFromToken(process.env.SMARTLOO_LIVE_OWNER, process.env.SMARTLOO_LIVE_OWNER_EMAIL);
async function mount(content) {
  await act(async () => root.render(<SessionProvider initialSession={current()} fetchImpl={fetchImpl}>
    <MapApiProvider>{content}</MapApiProvider></SessionProvider>));
}
async function waitFor(predicate) {
  for (let i = 0; i < 150; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    if (predicate()) return;
  }
  throw new Error(`AI screen did not settle: ${host.textContent}`);
}
const props = { isOpen: true, searchCenter: { lat: 41, lon: 29 }, radius: 50, filters,
  hasLocationPermission: false, onClose: () => {} };

beforeEach(() => {
  if (!origin || !facility) throw new Error("Run scripts/check_map_reviews_live.py --suite ai");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe("Mounted AI screens with real SQL/Mongo/Redis and synthetic model", () => {
  it("renders the actual summary response and refreshes after a real edit", async () => {
    let firstId;
    for (const role of ["OWNER", "OTHER", "ADMIN"]) {
      const result = await fetch(`${origin}/api/v1/toilets/${facility}/reviews`, { method: "POST",
        headers: { Authorization: `Bearer ${process.env[`SMARTLOO_LIVE_${role}`]}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cleanliness_score: 4, comment: "Temizdi." }) });
      expect(result.status).toBe(201);
      const review = await result.json();
      if (role === "OWNER") firstId = review.id;
    }
    await mount(<AiSummaryBox toiletId={facility} />);
    await waitFor(() => host.textContent.includes("3 yoruma dayalı"));
    expect(host.textContent).toContain("AI-generated summary");
    expect(host.textContent).not.toContain("Sabun eksik");
    const changed = await fetch(`${origin}/api/v1/reviews/${firstId}`, { method: "PATCH",
      headers: { Authorization: `Bearer ${process.env.SMARTLOO_LIVE_OWNER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "Sabun yoktu." }) });
    expect(changed.status).toBe(200);
    await mount(<AiSummaryBox toiletId={facility} refreshKey={1} />);
    await waitFor(() => host.textContent.includes("Sabun eksik"));
  });

  it("shows real nearby fallback facilities, the explanation, and selected coordinates", async () => {
    const selected = vi.fn();
    await mount(<AiRecommendationsPanel {...props} onSelectToilet={selected} />);
    await waitFor(() => host.textContent.includes("Map review test"));
    expect(host.textContent).toContain("AI açıklaması mevcut değil");
    expect(host.textContent).toContain("Yakındaki Uygun Tesisler");
    expect(host.textContent).not.toContain("AI Tesis Önerileri");
    expect(host.textContent).not.toContain("Mesafe:");
    const item = [...host.querySelectorAll("button")].find(node => node.textContent.includes("Map review test"));
    await act(async () => item.click());
    expect(selected.mock.calls[0][0]).toMatchObject({ id: facility, latitude: 41, longitude: 29 });
  });

  it("returns a real empty-area message instead of invented suggestions", async () => {
    await mount(<AiRecommendationsPanel {...props} searchCenter={{ lat: 0, lon: 0 }} />);
    await waitFor(() => host.textContent.includes("aktif tesis bulunamadı"));
    expect(host.querySelectorAll("li")).toHaveLength(0);
  });

  it("does not interpret an unknown fee as free in the mounted filter", async () => {
    await mount(<AiRecommendationsPanel {...props} filters={{ pricing: "free" }} />);
    await waitFor(() => host.textContent.includes("aktif tesis bulunamadı"));
    expect(host.textContent).not.toContain("Map review test");
  });
});
