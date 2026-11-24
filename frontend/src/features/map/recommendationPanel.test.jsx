// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { MapApiProvider } from "./MapApiProvider.jsx";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";
import AiSummaryBox from "./AiSummaryBox.jsx";

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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); localStorage.clear(); });

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


function LanguageSwitch() {
  const { setLang } = useI18n();
  return <button data-language-switch onClick={() => setLang("en")}>English</button>;
}

it("translates the recommendation fallback without requesting locations again", async () => {
  const fetchImpl = vi.fn(async () => Response.json({
    results: [{ id: "nearby", name: "Yakındaki tesis", latitude: 41, longitude: 29 }],
    fallback: true,
    ai_reasons_available: false,
    message: "AI açıklaması mevcut değil; filtrelerinize uygun tesisler mesafeye göre listeleniyor.",
  }));
  await act(async () => root.render(
    <I18nProvider initialLang="tr">
      <LanguageSwitch />
      <SessionProvider initialSession={current} fetchImpl={fetchImpl}>
        <MapApiProvider>
          <AiRecommendationsPanel isOpen searchCenter={center} filters={filters} />
        </MapApiProvider>
      </SessionProvider>
    </I18nProvider>,
  ));

  expect(host.querySelector("aside").getAttribute("aria-label")).toBe("Yakındaki uygun tesisler");
  await act(async () => host.querySelector("[data-language-switch]").click());
  expect(host.querySelector("aside").getAttribute("aria-label")).toBe("Matching nearby facilities");
  expect(host.querySelector("[role=status]").textContent).toContain("listed by distance");
  expect(host.textContent).toContain("Yakındaki tesis");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it("localises the summary interface while identifying the Turkish model output", async () => {
  const fetchImpl = vi.fn(async () => Response.json({
    summary: "Temizdi.",
    pros: ["Temiz"],
    based_on_reviews: 3,
    recommendation: "recommended",
  }));
  await act(async () => root.render(
    <I18nProvider initialLang="en">
      <SessionProvider initialSession={current} fetchImpl={fetchImpl}>
        <MapApiProvider><AiSummaryBox toiletId="12" /></MapApiProvider>
      </SessionProvider>
    </I18nProvider>,
  ));

  expect(host.querySelector("section").getAttribute("aria-label")).toBe("AI review summary");
  expect(host.textContent).toContain("Recommended");
  expect(host.textContent).toContain("Based on 3 reviews");
  expect(host.querySelector('p[lang="tr"]').textContent).toBe("Temizdi.");
});
