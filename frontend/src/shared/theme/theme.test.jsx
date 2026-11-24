// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
  it("defaults to light even on a dark OS and still resolves explicit system choices", () => {
    mockSystem(true);
    expect(loadPreference()).toBe("light");
    expect(resolveTheme(loadPreference())).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("stores only an explicit choice and ignores junk values", () => {
    savePreference("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    savePreference("system");
    expect(localStorage.getItem(THEME_KEY)).toBe("system");
    expect(loadPreference()).toBe("system");
    localStorage.setItem(THEME_KEY, "purple");
    expect(loadPreference()).toBe("light");
  });

  it("cycles Sistem → Açık → Koyu", () => {
    expect(["system", "light", "dark"].map(nextPreference)).toEqual(["light", "dark", "system"]);
  });

  it("writes the resolved theme to <html data-theme>", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses the same light default and saved choices before the first paint", () => {
    mockSystem(true);
    const html = readFileSync("index.html", "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const boot = new Function("window", "document", "localStorage", script);
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    try {
    for (const [saved, expected] of [[null, "light"], ["purple", "light"], ["dark", "dark"], ["system", "dark"], ["light", "light"]]) {
      localStorage.clear();
      if (saved) localStorage.setItem(THEME_KEY, saved);
      boot(window, document, localStorage);
      expect(document.documentElement.dataset.theme).toBe(expected);
      expect(resolveTheme(loadPreference())).toBe(expected);
    }
    boot(window, document, { getItem() { throw new Error("blocked storage"); } });
    expect(document.documentElement.dataset.theme).toBe("light");
    } finally { meta.remove(); }
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

  it("starts light, follows the system only when selected and remembers a dark choice", async () => {
    const system = mockSystem(true);
    await act(async () => root.render(<SettingsMenu />));
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => host.querySelector(".sl-settings-button").click());
    expect(themeButton("Açık").getAttribute("aria-checked")).toBe("true");
    await act(async () => themeButton("Sistem").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("system");

    await act(async () => themeButton("Açık").click());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => themeButton("Koyu").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(themeButton("Koyu").getAttribute("aria-checked")).toBe("true");
    await act(async () => root.render(<SettingsMenu key="reload" />));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
