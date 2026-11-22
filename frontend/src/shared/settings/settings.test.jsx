// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SettingsMenu from "./SettingsMenu.jsx";
import { loadMapsApp, loadStartRadius, loadStartView, saveStartRadius } from "./preferences.js";

let host;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const radio = (group, label) =>
  [...host.querySelectorAll(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`)].find((b) => b.textContent === label);
const field = (label) => {
  const el = [...host.querySelectorAll("label")].find((l) => l.textContent === label);
  return host.querySelector(`#${CSS.escape(el.htmlFor)}`);
};
// Opens the dropdown named `label` and picks the option with text `option`.
async function choose(label, option) {
  const button = [...host.querySelectorAll(".sl-dropdown-button")].find((b) => b.getAttribute("aria-label").startsWith(`${label}:`));
  await act(async () => button.click());
  const item = [...host.querySelectorAll('.sl-dropdown-menu [role="radio"]')].find((b) => b.textContent === option);
  await act(async () => item.click());
  expect(host.querySelector(".sl-dropdown-menu")).toBeNull();
  expect(button.getAttribute("aria-label")).toBe(`${label}: ${option}`);
}

describe("settings menu", () => {
  it("opens from the gear button, focuses inside and closes with Escape", async () => {
    await act(async () => root.render(<SettingsMenu />));
    const button = host.querySelector(".sl-settings-button");
    expect(button.getAttribute("aria-label")).toBe("Ayarlar");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector(".sl-settings-panel").contains(document.activeElement)).toBe(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(host.querySelector(".sl-settings-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("stores the start view, radius, maps app and reduced motion", async () => {
    await act(async () => root.render(<SettingsMenu />));
    await act(async () => host.querySelector(".sl-settings-button").click());

    await act(async () => radio("Harita açılınca", "Yakınımda").click());
    expect(loadStartView()).toBe("nearby");
    await choose("Varsayılan yarıçap", "2,5 km");
    expect(loadStartRadius()).toBe(2500);
    await choose("Yol tarifi uygulaması", "Yandex Haritalar");
    expect(loadMapsApp()).toBe("yandex");
    expect(host.querySelector(".sl-settings-panel")).not.toBeNull();
    await choose("Yol tarifi uygulaması", "Her seferinde sor");
    expect(localStorage.getItem("smartloo.mapsApp")).toBeNull();

    await act(async () => field("Hareketi azalt").click());
    expect(document.documentElement.dataset.motion).toBe("reduce");
    expect(localStorage.getItem("smartloo.reduceMotion")).toBe("on");
    await act(async () => field("Hareketi azalt").click());
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("ignores unexpected stored values", () => {
    localStorage.setItem("smartloo.startRadius", "123");
    localStorage.setItem("smartloo.mapsApp", "bing");
    localStorage.setItem("smartloo.startView", "moon");
    expect(loadStartRadius()).toBe(1000);
    expect(loadMapsApp()).toBe("ask");
    expect(loadStartView()).toBe("city");
    saveStartRadius(1000);
    expect(localStorage.getItem("smartloo.startRadius")).toBeNull();
  });
});
