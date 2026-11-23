// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPlatform, directionsOptions, validCoordinates } from "./directions.js";
import DirectionsButton from "./DirectionsButton.jsx";

const KADIKOY = { lat: 40.990461, lon: 29.029162, name: "Moda Sahil WC" };

describe("directions links", () => {
  it("rejects missing or impossible coordinates instead of guessing", () => {
    expect(validCoordinates(null, 29)).toBeNull();
    expect(validCoordinates(41, undefined)).toBeNull();
    expect(validCoordinates("abc", 29)).toBeNull();
    expect(validCoordinates(91, 29)).toBeNull();
    expect(validCoordinates(41, 181)).toBeNull();
    expect(validCoordinates("41.0123456789", "29")).toEqual({ lat: 41.012346, lon: 29 });
    expect(directionsOptions({ lat: null, lon: null }, "android")).toEqual({ geo: null, providers: [] });
  });

  it("uses a geo: link on Android so the phone's own app chooser opens", () => {
    const { geo, providers } = directionsOptions(KADIKOY, "android");
    expect(geo).toBe("geo:40.990461,29.029162?q=40.990461,29.029162(Moda%20Sahil%20WC)");
    expect(providers.length).toBeGreaterThan(0);
  });

  it("offers Apple Maps first on iPhone and Mac, Google first elsewhere", () => {
    expect(directionsOptions(KADIKOY, "ios").providers.map((p) => p.id)).toEqual(["apple", "google", "yandex"]);
    expect(directionsOptions(KADIKOY, "mac").providers[0].id).toBe("apple");
    expect(directionsOptions(KADIKOY, "other").providers[0].id).toBe("google");
    expect(directionsOptions(KADIKOY, "ios").geo).toBeNull();
  });

  it("sends only the destination, never a start point", () => {
    const { providers } = directionsOptions(KADIKOY, "other");
    const google = new URL(providers.find((p) => p.id === "google").href);
    expect(google.searchParams.get("destination")).toBe("40.990461,29.029162");
    expect(google.searchParams.has("origin")).toBe(false);
    const apple = new URL(providers.find((p) => p.id === "apple").href);
    expect(apple.searchParams.get("daddr")).toBe("40.990461,29.029162");
    expect(apple.searchParams.has("saddr")).toBe(false);
    for (const p of providers) expect(p.href.startsWith("https://")).toBe(true);
  });

  it("detects platforms from the user agent, including iPadOS reporting as a Mac", () => {
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" })).toBe("android");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe("ios");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe("ios");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe("mac");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe("other");
    expect(detectPlatform(undefined)).toBe("other");
  });
});

describe("DirectionsButton", () => {
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
  });

  const render = (props) => act(async () => root.render(<DirectionsButton latitude={KADIKOY.lat} longitude={KADIKOY.lon} name={KADIKOY.name} {...props} />));

  it("is a single geo: link on Android", async () => {
    await render({ platform: "android" });
    const link = host.querySelector("a.sl-directions-button");
    expect(link.getAttribute("href")).toMatch(/^geo:40\.990461,29\.029162/);
    expect(link.textContent).toContain("Yol tarifi al");
    expect(host.querySelector("button")).toBeNull();
  });

  it("opens an app menu on iPhone, focuses the first app and closes with Escape", async () => {
    await render({ platform: "ios" });
    const button = host.querySelector("button.sl-directions-button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const links = [...host.querySelectorAll(".sl-directions-menu a")];
    expect(links.map((a) => a.textContent)).toEqual([
      expect.stringContaining("Apple Haritalar"),
      expect.stringContaining("Google Haritalar"),
      expect.stringContaining("Yandex Haritalar"),
    ]);
    expect(document.activeElement).toBe(links[0]);
    expect(links[0].getAttribute("rel")).toContain("noopener");

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(host.querySelector(".sl-directions-menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("says why there is no route when the facility has no coordinates", async () => {
    await act(async () => root.render(<DirectionsButton latitude={null} longitude={null} name="X" platform="ios" />));
    expect(host.textContent).toContain("konumu kayıtlı olmadığı için");
    expect(host.querySelector("a, button")).toBeNull();
  });
});

describe("remembered maps app", () => {
  let host;
  let root;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
  });

  const render = (platform) =>
    act(async () => root.render(<DirectionsButton key={Math.random()} latitude={KADIKOY.lat} longitude={KADIKOY.lon} name={KADIKOY.name} platform={platform} />));

  it("asks every time unless the user ticks “Bu seçimi varsayılan yap”", async () => {
    await render("ios");
    await act(async () => host.querySelector("button.sl-directions-button").click());
    const google = [...host.querySelectorAll(".sl-directions-menu a")].find((a) => a.textContent.includes("Google"));
    google.addEventListener("click", (e) => e.preventDefault());
    await act(async () => google.click());
    expect(localStorage.getItem("smartloo.mapsApp")).toBeNull();

    await act(async () => host.querySelector("button.sl-directions-button").click());
    await act(async () => host.querySelector(".sl-directions-remember input").click());
    const apple = [...host.querySelectorAll(".sl-directions-menu a")].find((a) => a.textContent.includes("Apple"));
    apple.addEventListener("click", (e) => e.preventDefault());
    await act(async () => apple.click());
    expect(localStorage.getItem("smartloo.mapsApp")).toBe("apple");

    const direct = host.querySelector("a.sl-directions-button");
    expect(direct.getAttribute("href")).toMatch(/^https:\/\/maps\.apple\.com\//);
    expect(host.textContent).toContain("Apple Haritalar ile açılır.");
  });

  it("uses the saved app even on Android, and “Başka uygulama seç” goes back to asking", async () => {
    localStorage.setItem("smartloo.mapsApp", "google");
    await render("android");
    expect(host.querySelector("a.sl-directions-button").getAttribute("href")).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Başka uygulama seç").click());
    expect(localStorage.getItem("smartloo.mapsApp")).toBeNull();
    expect(host.querySelector("a.sl-directions-button").getAttribute("href")).toMatch(/^geo:/);
  });
});
