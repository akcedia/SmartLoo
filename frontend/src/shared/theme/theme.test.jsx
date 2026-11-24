// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, loadPreference, nextPreference, resolveTheme, savePreference, THEME_KEY } from "./theme.js";
import SettingsMenu from "../settings/SettingsMenu.jsx";

function mockSystem(dark) {
  const listeners = new Set();
  const query = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => query);
  return {
    set(next) {
      query.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme preference", () => {
  it("defaults to the system theme and resolves it", () => {
    expect(loadPreference()).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("stores only an explicit choice and ignores junk values", () => {
    savePreference("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    savePreference("system");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    localStorage.setItem(THEME_KEY, "purple");
    expect(loadPreference()).toBe("system");
  });

  it("cycles Sistem → Açık → Koyu", () => {
    expect(["system", "light", "dark"].map(nextPreference)).toEqual(["light", "dark", "system"]);
  });

  it("writes the resolved theme to <html data-theme>", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("theme in the settings menu", () => {
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

  const themeButton = (label) =>
    [...host.querySelectorAll('[role="radiogroup"][aria-label="Tema"] [role="radio"]')].find((b) => b.textContent === label);

  it("follows the system until the user picks a theme, and remembers the pick", async () => {
    const system = mockSystem(false);
    await act(async () => root.render(<SettingsMenu />));
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => host.querySelector(".sl-settings-button").click());
    expect(themeButton("Sistem").getAttribute("aria-checked")).toBe("true");

    await act(async () => themeButton("Açık").click());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => themeButton("Koyu").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeButton("Koyu").getAttribute("aria-checked")).toBe("true");
  });
});
