// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SearchPage from "./SearchPage.jsx";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { MapApiProvider } from "./MapApiProvider.jsx";
import { createToiletApi } from "./toiletApi.js";

vi.mock("./MapView.jsx", () => ({ default: ({citywide, toilets}) =>
  <div data-testid="map-mode">{citywide ? "city" : "nearby"}:{toilets.length}</div> }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "geolocation", {configurable:true, value:undefined});
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const response = rows => ({ok:true, status:200, json:async () => ({count:rows.length, results:rows})});

it("keeps the source markers and explains unavailable filters instead of hiding every facility", async () => {
  const rows = [{id:"a"},{id:"b"}];
  const fetchImpl = vi.fn(async () => ({ok:true, status:200, json:async () => ({results:rows,
    filter_coverage:{total:2, open_now:0, has_disabled_access:0, has_baby_changing:0, is_free:0}})}));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("city:2");
  for (const label of ["Şu An Açık", "Engelli Erişimi", "Bebek Bakım", "Ücretsiz", "Ücretli"]) {
    const button = [...host.querySelectorAll("button")].find(node => node.textContent === `${label} (bilgi yok)`);
    expect(button?.disabled).toBe(true);
    await act(async () => button.click());
  }
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Engelli erişimi 0/2");
  expect(host.textContent).toContain("çalışma saati doğrulanmış aktif tesis 0/2");
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("city:2");
});

it("keeps filters available when the source has verified values", async () => {
  const fetchImpl = vi.fn(async () => ({ok:true, status:200, json:async () => ({results:[{id:"a"}],
    filter_coverage:{total:2, open_now:1, has_disabled_access:1, has_baby_changing:1, is_free:2}})}));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  const button = [...host.querySelectorAll("button")].find(node => node.textContent === "Engelli Erişimi");
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(fetchImpl.mock.calls.at(-1)[0]).toContain("has_disabled_access=true");
  const openButton = [...host.querySelectorAll("button")].find(node => node.textContent === "Şu An Açık");
  expect(openButton.disabled).toBe(false);
  await act(async () => openButton.click());
  expect(fetchImpl.mock.calls.at(-1)[0]).toContain("open_now=true");
});

it("city requests preserve unknown filters and use the public source directory", async () => {
  const request = vi.fn(async () => ({}));
  await createToiletApi(request).fetchIbbToilets({filters:{pricing:"all", open_now:false}});
  expect(request).toHaveBeenCalledWith("/api/v1/toilets", {query:{}, auth:false, signal:undefined});
  await createToiletApi(request).fetchIbbToilets({filters:{pricing:"paid", open_now:true, has_baby_changing:true}});
  expect(request.mock.calls[1][1].query).toEqual({is_free:false, open_now:true, has_baby_changing:true});
});

it("lets the user clear an active open filter if verified hours disappear", async () => {
  let hasHours = true;
  const fetchImpl = vi.fn(async path => ({ok:true, status:200, json:async () => ({
    results: path.includes("open_now=true") ? [] : [{id:"a"}],
    filter_coverage:{total:1, open_now:hasHours ? 1 : 0},
  })}));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  const button = [...host.querySelectorAll("button")].find(node => node.textContent === "Şu An Açık");
  hasHours = false;
  await act(async () => button.click());
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("city:1");
});

it("starts citywide with open-only off, and can switch back to the real nearby endpoint", async () => {
  const fetchImpl = vi.fn(async path => response(path.startsWith("/api/v1/toilets/nearby") ? [] : [{id:"a"},{id:"b"}]));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("city:2");
  expect(fetchImpl.mock.calls[0][0]).toBe("/api/v1/toilets");
  expect(host.textContent).toContain("İBB Açık Veri Lisansı");
  const nearby = [...host.querySelectorAll("button")].find(b => b.textContent === "Yakınımda");
  await act(async () => nearby.click());
  expect(fetchImpl.mock.calls.at(-1)[0]).toContain("/api/v1/toilets/nearby?");
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("nearby:0");
});

it("an unavailable source is an error with retry, not an empty city", async () => {
  await act(async () => root.render(<SessionProvider initialSession={null}
    fetchImpl={async () => ({ok:false,status:503,json:async () => ({detail:"Not imported"})})}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  expect(host.textContent).toContain("Tesis verileri yüklenemedi");
  expect(host.textContent).not.toContain("Seçili filtrelere uygun İBB kaydı bulunamadı");
  expect([...host.querySelectorAll("button")].some(b => b.textContent === "Yeniden Dene")).toBe(true);
});

it.each([null, true, false])("nearby uses its own opening information (%s), not the city coverage", async isOpen => {
  const fetchImpl = vi.fn(async path => ({ok:true, status:200, json:async () =>
    path.startsWith("/api/v1/toilets/nearby")
      ? {results:[{id:"near", is_open_now:isOpen}]}
      : {results:[{id:"city"}], filter_coverage:{total:1, open_now:0}}
  }));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Yakınımda").click());
  const button = [...host.querySelectorAll("button")].find(b => b.textContent.startsWith("Şu An Açık"));
  expect(button.disabled).toBe(isOpen === null);
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("nearby:1");
  const calls = fetchImpl.mock.calls.length;
  await act(async () => button.click());
  if (isOpen === null) {
    expect(fetchImpl).toHaveBeenCalledTimes(calls);
    expect(host.textContent).toContain("Bu sonuçlarda çalışma saati bilgisi yok");
  } else {
    expect(fetchImpl.mock.calls.at(-1)[0]).toContain("open_now=true");
  }
});
