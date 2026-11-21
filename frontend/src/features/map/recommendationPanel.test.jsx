// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { MapApiProvider } from "./MapApiProvider.jsx";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";

let root, host;
const filters = { pricing: "all" };
const center = { lat: 41, lon: 29 };
const current = sessionFromToken(fakeJwt({ sub: "viewer", role: "USER", exp: Date.now() / 1000 + 3600 }), "viewer@example.com");
const response = (name, status = 200) => ({ ok: status < 400, status, json: async () => ({
  results: [{ id: name, name, latitude: 41, longitude: 29, reason: "Unverified provider text" }],
  fallback: true, ai_reasons_available: false, message: "AI açıklaması mevcut değil." }) });
async function mount(fetchImpl, radius = 500) {
  await act(async () => root.render(<SessionProvider initialSession={current} fetchImpl={fetchImpl}>
    <MapApiProvider><AiRecommendationsPanel isOpen searchCenter={center} radius={radius} filters={filters}
      hasLocationPermission={false} onClose={() => {}} /></MapApiProvider>
  </SessionProvider>));
}
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); });

it("forwards the selected radius and shows a fallback notice beside real results", async () => {
  const fetchImpl = vi.fn(async () => response("Nearby"));
  await mount(fetchImpl);
  expect(new URL(fetchImpl.mock.calls[0][0], "http://localhost").searchParams.get("radius")).toBe("500");
  expect(host.textContent).toContain("Nearby");
  expect(host.textContent).toContain("AI açıklaması mevcut değil");
  expect(host.textContent).not.toContain("Unverified provider text");
  expect(host.textContent).not.toContain("AI Tesis Önerileri");
});

it("does not replace new-radius results with a late old response", async () => {
  let finishOld;
  const fetchImpl = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockImplementation(async () => response("New radius"));
  await mount(fetchImpl);
  await mount(fetchImpl, 2000);
  expect(host.textContent).toContain("New radius");
  await act(async () => finishOld(response("Old radius")));
  expect(host.textContent).not.toContain("Old radius");
  expect(host.textContent).toContain("New radius");
});

it("reports an unavailable recommendation store without showing invented results", async () => {
  await mount(async () => response("Never display", 503));
  expect(host.textContent).toContain("normal harita aramasıyla devam edebilirsiniz");
  expect(host.textContent).not.toContain("Never display");
});
