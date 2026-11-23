// @vitest-environment jsdom
// Map page layout: grouped controls, filter panel, list view, "Konumum" and pin states.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./SearchPage.jsx";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { MapApiProvider } from "./MapApiProvider.jsx";
import { pinState } from "./mapPins.js";

vi.mock("./MapView.jsx", () => ({
  default: ({ citywide, toilets, selectedToilet }) => (
    <div data-testid="map-mode">{citywide ? "city" : "nearby"}:{toilets.length}:{selectedToilet?.id ?? "-"}</div>
  ),
}));

const ROWS = [
  { id: "far", name: "Uzak", district: "Fatih", distance_m: 900, is_open_now: null, latitude: 41, longitude: 29 },
  { id: "near", name: "Yakın", district: "Kadıköy", distance_m: 120, is_open_now: true, latitude: 41, longitude: 29 },
];

let root;
let host;
let geolocation;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  geolocation = { getCurrentPosition: vi.fn((ok, fail) => fail()) };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const button = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

async function render(fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: ROWS }) })), initialSession = null) {
  await act(async () =>
    root.render(
      <SessionProvider initialSession={initialSession} fetchImpl={fetchImpl}>
        <MapApiProvider>
          <SearchPage />
        </MapApiProvider>
      </SessionProvider>,
    ),
  );
  return fetchImpl;
}

describe("pin state", () => {
  it("uses only known facts: open, closed/not active, otherwise unknown", () => {
    expect(pinState({ is_open_now: true, status: "ACTIVE" })).toBe("open");
    expect(pinState({ is_open_now: false })).toBe("closed");
    expect(pinState({ is_open_now: true, status: "MAINTENANCE" })).toBe("closed");
    expect(pinState({ is_open_now: null })).toBe("unknown");
    expect(pinState({})).toBe("unknown");
    expect(pinState(null)).toBe("unknown");
  });
});

describe("map page layout", () => {
  it("uses the map's selected radius for recommendations and refreshes an open panel when it changes", async () => {
    const session = sessionFromToken(fakeJwt({ sub: "viewer", role: "USER", exp: Date.now() / 1000 + 3600 }), "viewer@example.com");
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: ROWS }) }));
    await render(fetchImpl, session);
    const selectRadius = async (label) => {
      await act(async () => host.querySelector(".sl-radius-button").click());
      const option = [...host.querySelectorAll(".sl-dropdown-menu button")].find((b) => b.textContent === label);
      await act(async () => option.click());
    };
    const recommendationUrls = () => fetchImpl.mock.calls.map(([url]) => new URL(url, "http://localhost"))
      .filter((url) => url.pathname === "/api/v1/recommendations");
    await selectRadius("5 km");
    await act(async () => button("AI Önerileri").click());
    expect(recommendationUrls().at(-1).searchParams.get("radius")).toBe("5000");
    await selectRadius("500 m");
    expect(recommendationUrls()).toHaveLength(2);
    expect(recommendationUrls().at(-1).searchParams.get("radius")).toBe("500");
  });

  it("groups the search mode and the main filters, with the rest in a closed panel", async () => {
    await render();
    const mode = host.querySelector(".sl-group-mode");
    const filters = host.querySelector(".sl-group-filters");
    expect(mode.textContent).toContain("İstanbul geneli");
    expect(mode.textContent).toContain("Yakınımda");
    expect(filters.textContent).toContain("Şu An Açık");
    expect(filters.textContent).toContain("Ücretsiz");
    expect(host.querySelector(".sl-filter-panel").hidden).toBe(true);
  });

  it("picks the radius from a compact dropdown next to Yakınımda and closes it again", async () => {
    const fetchImpl = await render();
    const picker = host.querySelector(".sl-radius-button");
    expect(picker.textContent).toBe("1 km");
    expect(host.querySelector(".sl-dropdown-menu")).toBeNull();
    await act(async () => picker.click());
    const options = [...host.querySelectorAll(".sl-dropdown-menu button")];
    expect(options.map((b) => b.textContent)).toEqual(["500 m", "1 km", "2,5 km", "5 km", "10 km"]);
    expect(document.activeElement.textContent).toBe("1 km");
    await act(async () => options[3].click());
    expect(host.querySelector(".sl-dropdown-menu")).toBeNull();
    expect(picker.textContent).toBe("5 km");
    expect(document.activeElement).toBe(picker);
    expect(host.querySelector('[data-testid="map-mode"]').textContent.startsWith("nearby:")).toBe(true);
    expect(fetchImpl.mock.calls.at(-1)[0]).toContain("radius=5000");
  });

  it("opens the filter panel, focuses inside it, counts extra filters and closes with Escape", async () => {
    await render();
    const toggle = host.querySelector(".sl-chip--filters");
    await act(async () => toggle.click());
    const panel = host.querySelector(".sl-filter-panel");
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.contains(document.activeElement)).toBe(true);

    await act(async () => button("Engelli Erişimi").click());
    expect(toggle.querySelector(".sl-badge").textContent).toBe("1");

    await act(async () => panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it("the Ücretsiz chip and the panel share one price filter", async () => {
    const fetchImpl = await render();
    await act(async () => host.querySelector(".sl-group-filters .sl-chip:nth-child(2)").click());
    expect(fetchImpl.mock.calls.at(-1)[0]).toContain("is_free=true");
    const panelFree = [...host.querySelectorAll('.sl-filter-panel [aria-label="Ücret filtresi"] button')].find((b) => b.textContent === "Ücretsiz");
    expect(panelFree.getAttribute("aria-pressed")).toBe("true");
  });

  it("lists facilities nearest first in nearby mode and opens one on the map", async () => {
    geolocation.getCurrentPosition = vi.fn((ok) => ok({ coords: { latitude: 41, longitude: 29 } }));
    await render();
    await act(async () => button("Yakınımda").click());
    await act(async () => button("Liste").click());
    const items = [...host.querySelectorAll(".sl-list-item")];
    expect(items.map((b) => b.querySelector(".sl-list-name").textContent)).toEqual(["Yakın", "Uzak"]);
    expect(items[0].textContent).toContain("120 m");
    expect(items[0].textContent).toContain("Şu an açık");
    expect(items[1].textContent).toContain("Saat bilinmiyor");

    await act(async () => items[0].click());
    expect(host.querySelector(".sl-list")).toBeNull();
    expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe("nearby:2:near");
  });

  it("Konumum asks for permission and explains a refusal without inventing a position", async () => {
    await render();
    const before = host.querySelector('[data-testid="map-mode"]').textContent;
    await act(async () => host.querySelector(".sl-fab--locate").click());
    expect(host.querySelector('.sl-notices [role="alert"]').textContent).toContain("Konum izni verilmedi");
    expect(host.querySelector('[data-testid="map-mode"]').textContent).toBe(before);
  });

  it("offers a way back to the city view when location is denied in nearby mode", async () => {
    await render();
    await act(async () => button("Yakınımda").click());
    expect(host.textContent).toContain("Konum izni yok");
    await act(async () => button("İstanbul geneline dön").click());
    expect(host.querySelector('[data-testid="map-mode"]').textContent.startsWith("city:")).toBe(true);
  });
});
