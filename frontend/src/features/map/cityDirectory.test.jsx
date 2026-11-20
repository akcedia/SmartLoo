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

it("city requests preserve unknown filters and use the public source directory", async () => {
  const request = vi.fn(async () => ({}));
  await createToiletApi(request).fetchIbbToilets({filters:{pricing:"all", open_now:false}});
  expect(request).toHaveBeenCalledWith("/api/v1/toilets", {query:{}, auth:false, signal:undefined});
  await createToiletApi(request).fetchIbbToilets({filters:{pricing:"paid", open_now:true, has_baby_changing:true}});
  expect(request.mock.calls[1][1].query).toEqual({is_free:false, open_now:true, has_baby_changing:true});
});

it("starts citywide with open-only off, and can switch back to the real nearby endpoint", async () => {
  const fetchImpl = vi.fn(async path => response(path.startsWith("/api/v1/toilets/nearby") ? [] : [{id:"a"},{id:"b"}]));
  await act(async () => root.render(<SessionProvider initialSession={null} fetchImpl={fetchImpl}>
    <MapApiProvider><SearchPage /></MapApiProvider></SessionProvider>));
  expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("city:2");
  expect(fetchImpl.mock.calls[0][0]).toBe("/api/v1/toilets");
  expect(host.textContent).toContain("İBB Açık Veri Lisansı");
  const nearby = [...host.querySelectorAll("button")].find(b => b.textContent === "Yakınımda ara");
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
