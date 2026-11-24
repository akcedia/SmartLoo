// Theme preference: "light" (default), "system" or "dark".
// The preference is a per-browser convenience in localStorage; the resolved theme is
// always written to <html data-theme>, which is the only switch the CSS reads.
// index.html runs the same resolution inline before first paint, so there is no flash.

export const THEME_KEY = "smartloo.theme";
export const PREFERENCES = ["system", "light", "dark"];

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadPreference() {
  try {
    const value = storage()?.getItem(THEME_KEY);
    return PREFERENCES.includes(value) ? value : "light";
  } catch {
    return "light";
  }
}

export function savePreference(preference) {
  try {
    storage()?.setItem(THEME_KEY, PREFERENCES.includes(preference) ? preference : "light");
  } catch {
    // Storage blocked (private mode): the choice still applies for this page.
  }
}

function darkQuery() {
  return typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
}

export function resolveTheme(preference, prefersDark = darkQuery()?.matches ?? false) {
  if (preference === "light" || preference === "dark") return preference;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme, { animate = false } = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add("sl-theme-switching");
    setTimeout(() => root.classList.remove("sl-theme-switching"), 250);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#030405" : "#ffffff");
}

/** Calls onChange(resolvedTheme) whenever the OS theme changes. Returns an unsubscribe function. */
export function watchSystemTheme(onChange) {
  const query = darkQuery();
  if (!query) return () => {};
  const listener = (event) => onChange(event.matches ? "dark" : "light");
  query.addEventListener?.("change", listener);
  return () => query.removeEventListener?.("change", listener);
}

export function nextPreference(preference) {
  return PREFERENCES[(PREFERENCES.indexOf(preference) + 1) % PREFERENCES.length];
}
