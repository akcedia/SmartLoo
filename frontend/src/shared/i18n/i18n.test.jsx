// @vitest-environment jsdom
import React, { act } from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { catalog, LANG_KEY, loadLang, saveLang, translate } from "./i18n.js";
import App from "../../app/App.jsx";
import { authErrorMessage, validateRegistration, validateSignIn } from "../../features/auth/validation.js";
import { deletionErrorMessage } from "../../features/auth/accountDeletion.js";
import { PRESETS, validateRange } from "../../features/admin/api/dateRange.js";
import { SCENARIOS } from "../../features/admin/api/sampleAdapter.js";
import { CRITICAL_ALERT_TEXT } from "../../features/admin/api/contract.js";
import { exportErrorMessage } from "../../features/admin/components/ExportButtons.jsx";
import { importErrorMessage, inspectImport } from "../../features/admin/import/importApi.js";
import { decisionErrorMessage, facilityStatusErrorMessage, listErrorMessage } from "../../features/admin/moderation/moderationApi.js";

const EN = catalog("en");
const SRC = join(process.cwd(), "src");
// Screens owned by the shared app (Onur). Map screens join this list when Furkan wraps them.
const TRANSLATED = ["app", "shared", "features/auth", "features/admin", "features/map/DirectionsButton.jsx", "features/map/SearchPage.jsx", "features/map/MapView.jsx", "features/map/RadiusPicker.jsx", "features/map/AdminFacilityStatus.jsx", "features/map/AiRecommendationsPanel.jsx", "features/map/AiSummaryBox.jsx"];

function sourceFiles(path) {
  const full = join(SRC, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => sourceFiles(join(path, name)));
}

describe("translate", () => {
  it("returns English from the catalog and fills placeholders", () => {
    expect(translate("en", "Giriş yap")).toBe("Sign in");
    expect(translate("en", "{n} değerlendirme", { n: 3 })).toBe("3 reviews");
    expect(translate("tr", "{n} değerlendirme", { n: 3 })).toBe("3 değerlendirme");
    expect(translate("en", "%{n}", { n: 75 })).toBe("75%");
  });

  it("falls back to Turkish for a string without an entry and leaves unknown placeholders", () => {
    expect(translate("en", "Henüz çevrilmedi")).toBe("Henüz çevrilmedi");
    expect(translate("en", "{x} kaldı")).toBe("{x} kaldı");
    expect(translate("en", null)).toBeNull();
  });

  it("defaults to Turkish and stores only an English choice", () => {
    localStorage.clear();
    expect(loadLang()).toBe("tr");
    saveLang("en");
    expect(localStorage.getItem(LANG_KEY)).toBe("en");
    saveLang("tr");
    expect(localStorage.getItem(LANG_KEY)).toBeNull();
    localStorage.setItem(LANG_KEY, "de");
    expect(loadLang()).toBe("tr");
  });
});

describe("English catalog coverage", () => {
  it("has an entry for every literal t(\"…\") in the translated screens", () => {
    const keys = new Set();
    for (const file of TRANSLATED.flatMap(sourceFiles)) {
      if (/\.test\.|\.live\./.test(file) || !/\.jsx?$/.test(file)) continue;
      for (const m of readFileSync(file, "utf8").matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(100);
    expect([...keys].filter((k) => !(k in EN))).toEqual([]);
  });

  it("has an entry for every message produced outside components", () => {
    const messages = [
      ...Object.values(validateSignIn({ email: "", password: "" })),
      ...Object.values(validateRegistration({ email: "x", password: "short", display_name: "a" })),
      ...Object.values(validateRegistration({ email: "a@b.co", password: `${"ğ".repeat(37)}1a`, display_name: "abc" })),
      ...[401, 409, 422, 429, 503, 0, 500].map((status) => authErrorMessage({ status }, "sign-in")),
      authErrorMessage({ status: 500 }, "register"),
      ...[401, 501, 0, 500].map((status) => deletionErrorMessage({ status })),
      ...Object.values(validateRange({ from: "x", to: "y" })),
      ...Object.values(validateRange({ from: "2026-11-10", to: "2026-11-01" })),
      ...Object.values(PRESETS).map((p) => p.label),
      ...Object.values(SCENARIOS),
      CRITICAL_ALERT_TEXT,
      ...[401, 403, 409, 413, 415, 422, 503, 0, 500].map((status) => importErrorMessage({ status })),
      ...[
        { text: "", size: 1, format: null },
        { text: "", size: 0, format: "csv" },
        { text: "", size: 2_000_000, format: "csv" },
        { text: "[oops", size: 5, format: "json" },
        { text: "{}", size: 2, format: "json" },
        { text: "[]", size: 2, format: "json" },
      ].map((input) => inspectImport(input).problem),
      inspectImport({ text: JSON.stringify(Array(1001).fill({})), size: 5000, format: "json" }).template,
      "Dosya okunamadı.",
      ...[401, 403, 404, 409, 422, 503, 0].flatMap((status) => [decisionErrorMessage({ status }), facilityStatusErrorMessage({ status }), listErrorMessage({ status })]),
      "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.",
      "Çıkış yaptınız.",
      "Hesabınız silindi. Yorumlarınız “Anonim” olarak kalır.",
    ];
    expect(messages.length).toBeGreaterThan(25);
    expect(messages.filter((m) => !(m in EN))).toEqual([]);
  });

  it("keeps every placeholder of the Turkish key in its English text", () => {
    const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const broken = Object.entries(EN).filter(([tr, en]) => names(tr).join() !== names(en).join());
    expect(broken).toEqual([]);
  });

  it("translates export errors with the format name", () => {
    expect(exportErrorMessage("csv", { status: 403 }, "en")).toBe("Could not download CSV: this needs admin permission.");
    expect(exportErrorMessage("csv", { status: 403 })).toMatch(/CSV indirilemedi/);
  });
});

describe("language switch in the app", () => {
  let host;
  let root;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    history.replaceState(null, "", "/sign-in");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("switches the header and page to English without losing typed input, and back", async () => {
    await act(async () => root.render(<App fetchImpl={async () => Response.json({})} />));
    expect(document.documentElement.lang).toBe("tr");
    expect(host.querySelector("h1").textContent).toBe("Giriş yap");

    const email = host.querySelector('input[type="email"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setValue.call(email, "ayse@example.com");
      email.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const english = () => [...host.querySelectorAll('[role="radio"]')].find((b) => b.textContent === "English");
    const turkish = () => [...host.querySelectorAll('[role="radio"]')].find((b) => b.textContent === "Türkçe");
    await act(async () => host.querySelector(".sl-settings-button").click());
    expect(english().getAttribute("lang")).toBe("en");
    await act(async () => english().click());

    expect(document.documentElement.lang).toBe("en");
    expect(host.querySelector("h1").textContent).toBe("Sign in");
    expect(host.querySelector("main label").textContent).toBe("Email");
    expect(host.querySelector(".sl-settings-button").getAttribute("aria-label")).toBe("Settings");
    expect(host.querySelector('input[type="email"]').value).toBe("ayse@example.com");
    expect(host.querySelector(".app-topnav").textContent).toContain("Map");
    expect(localStorage.getItem(LANG_KEY)).toBe("en");

    await act(async () => turkish().click());
    expect(host.querySelector("h1").textContent).toBe("Giriş yap");
    expect(document.documentElement.lang).toBe("tr");
  });
});
