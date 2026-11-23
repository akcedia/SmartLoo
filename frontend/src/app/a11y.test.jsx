// Accessibility checks for Onur's screens (NFR-06, WCAG 2.1 AA target).
// Automated checks support, but do not replace, the manual keyboard review.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { focusPageHeading } from "./App.jsx";
import AccountMenu from "./AccountMenu.jsx";
import { focusFirstError } from "../features/auth/useFocusFirstError.js";
import { SessionProvider } from "../shared/session/SessionProvider.jsx";
import SignInPage from "../features/auth/SignInPage.jsx";
import RegisterPage from "../features/auth/RegisterPage.jsx";
import FacilityTable from "../features/admin/components/FacilityTable.jsx";
import KpiCards from "../features/admin/components/KpiCards.jsx";
import TrendChart from "../features/admin/components/TrendChart.jsx";
import { SUMMARY_TC09 } from "../features/admin/api/contractExamples.js";

// --- contrast ---------------------------------------------------------------
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Both themes are measured from shared/theme/theme.css: the light block is
// `:root[data-theme="light"]`, the dark block `:root[data-theme="dark"]`.
function themeTokens(name) {
  const css = readFileSync(new URL("../shared/theme/theme.css", import.meta.url), "utf8");
  const start = css.indexOf(`:root[data-theme="${name}"] {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...block.matchAll(/--sl-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

describe.each(["light", "dark"])("colour contrast of the %s theme", (name) => {
  const t = themeTokens(name);

  it("defines every token the pairs below use", () => {
    for (const key of ["bg", "surface", "surface-raised", "surface-sunken", "text", "text-secondary", "text-muted", "text-faint", "border-strong", "accent-solid", "accent-solid-hover", "on-accent", "accent-text", "accent-soft", "danger", "danger-soft", "ok", "ok-soft", "warn", "warn-soft", "ai", "ai-soft"]) {
      expect(t[key], key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ["text on page background", "text", "bg", 4.5],
    ["text on surface", "text", "surface", 4.5],
    ["secondary text on surface", "text-secondary", "surface", 4.5],
    ["muted text on page background", "text-muted", "bg", 4.5],
    ["muted text on surface", "text-muted", "surface", 4.5],
    ["muted text on sunken surface", "text-muted", "surface-sunken", 4.5],
    ["muted text on raised surface", "text-muted", "surface-raised", 4.5],
    ["hint text on surface", "text-faint", "surface", 4.5],
    ["hint / disabled text on page background", "text-faint", "bg", 4.5],
    ["links on page background", "accent-text", "bg", 4.5],
    ["links on surface", "accent-text", "surface", 4.5],
    ["active nav / selected chip", "accent-text", "accent-soft", 4.5],
    ["button text on accent fill", "on-accent", "accent-solid", 4.5],
    ["button text on hover fill", "on-accent", "accent-solid-hover", 4.5],
    ["error text", "danger", "danger-soft", 4.5],
    ["error text on surface", "danger", "surface", 4.5],
    ["danger button text", "bg", "danger", 4.5],
    ["success text / 'Aktif' pill", "ok", "ok-soft", 4.5],
    ["maintenance / warning text", "warn", "warn-soft", 4.5],
    ["AI label", "ai", "ai-soft", 4.5],
    ["AI toggle text", "surface", "ai", 4.5],
    ["form control border (non-text)", "border-strong", "surface", 3],
    ["accent fill against surface (non-text)", "accent-solid", "surface", 3],
  ])("%s", (_, fg, bg, min) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe("components use theme tokens", () => {
  it.each(["../app/app.css", "../features/admin/admin.css"])("%s has no hard-coded colors", (file) => {
    const css = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(css.match(/#[0-9a-fA-F]{3,6}\b/g)).toBeNull();
  });
});

// --- focus management (no DOM library: minimal element doubles) ------------
function element(attrs = {}) {
  const el = {
    attrs: { ...attrs },
    focus: vi.fn(),
    getAttribute: (k) => el.attrs[k] ?? null,
    hasAttribute: (k) => k in el.attrs,
    setAttribute: (k, v) => {
      el.attrs[k] = v;
    },
  };
  return el;
}

describe("focus management", () => {
  it("moves focus to the new page's h1 after navigation", () => {
    const h1 = element();
    focusPageHeading({ querySelector: (sel) => (sel === "h1" ? h1 : null) });
    expect(h1.focus).toHaveBeenCalled();
    expect(h1.attrs.tabindex).toBe("-1");
  });

  it("falls back to the main region when a page has no h1", () => {
    const root = element();
    root.querySelector = () => null;
    focusPageHeading(root);
    expect(root.focus).toHaveBeenCalled();
  });

  it("after a rejected submit, focuses the form alert first", () => {
    const alert = element({ role: "alert" });
    const field = element({ "aria-invalid": "true" });
    focusFirstError({ querySelector: (sel) => (sel.includes("alert") ? alert : field) });
    expect(alert.focus).toHaveBeenCalled();
    expect(field.focus).not.toHaveBeenCalled();
  });

  it("otherwise focuses the first invalid field", () => {
    const field = element({ "aria-invalid": "true" });
    focusFirstError({ querySelector: (sel) => (sel.includes("aria-invalid") ? field : null) });
    expect(field.focus).toHaveBeenCalled();
  });

  it("does nothing when there is no error", () => {
    expect(() => focusFirstError({ querySelector: () => null })).not.toThrow();
    expect(() => focusFirstError(null)).not.toThrow();
  });
});

// --- semantics -------------------------------------------------------------
describe("semantics", () => {
  const withSession = (el) => renderToStaticMarkup(<SessionProvider initialSession={null}>{el}</SessionProvider>);

  it("every form input has a matching label", () => {
    for (const html of [withSession(<SignInPage />), withSession(<RegisterPage />)]) {
      const inputIds = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
      const labelFors = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
      expect(inputIds.length).toBeGreaterThan(0);
      expect(labelFors.sort()).toEqual(inputIds.sort());
    }
  });

  it("the account menu is a disclosure button, not a fake menu", () => {
    const session = { email: "a@b.co", role: "USER", expiresAt: Date.now() + 1000 };
    const html = renderToStaticMarkup(<AccountMenu session={session} onSignOut={() => {}} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("aria-haspopup");
  });

  it("the facility table keeps explicit table roles for the card layout", () => {
    const html = renderToStaticMarkup(<FacilityTable rows={SUMMARY_TC09.facilities} />);
    for (const role of ["table", "rowgroup", "row", "columnheader", "rowheader", "cell"]) {
      expect(html).toContain(`role="${role}"`);
    }
  });

  it("KPI cards sit under an h2 so headings do not jump from h1 to h3", () => {
    expect(renderToStaticMarkup(<KpiCards data={SUMMARY_TC09} />)).toMatch(/<h2[^>]*>Özet göstergeler<\/h2>/);
  });

  it("the trend chart has a text table with the same daily values", () => {
    const html = renderToStaticMarkup(<TrendChart trend={SUMMARY_TC09.trend} threshold={3.5} />);
    expect(html).toContain("5 gün değerlendirmesiz");
    expect(html).toContain("<th scope=\"row\">2026-10-02</th><td>4.00</td><td>1</td>");
    expect(html).toContain("2.00 (kritik)");
  });

  it("the hidden trend table sits inside a 1px wrapper so it cannot widen the page", () => {
    const html = renderToStaticMarkup(<TrendChart trend={SUMMARY_TC09.trend} threshold={3.5} />);
    expect(html).toMatch(/<div class="admin-sr"><table>/);
    expect(html).not.toMatch(/<table class="admin-sr"/);
  });
});
