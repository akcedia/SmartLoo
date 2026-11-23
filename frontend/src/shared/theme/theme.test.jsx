// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, loadPreference, nextPreference, resolveTheme, savePreference, THEME_KEY } from "./theme.js";
import ThemeToggle from "./ThemeToggle.jsx";

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

describe("ThemeToggle", () => {
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

  it("follows the system until the user picks a theme, and remembers the pick", async () => {
    const system = mockSystem(false);
    await act(async () => root.render(<ThemeToggle />));
    const button = host.querySelector("button");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button.getAttribute("aria-label")).toBe("Tema: Sistem. Açık temaya geç");

    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => button.click()); // → Açık
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    await act(async () => system.set(true));
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => button.click()); // → Koyu
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Tema: Koyu. Sistem temaya geç");
  });
});
