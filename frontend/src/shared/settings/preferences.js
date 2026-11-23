// Per-browser preferences shown in the Settings menu. Conveniences only: nothing
// here is sent to the server, and every read falls back to a default when storage
// is blocked or holds an unexpected value. Theme and language live in
// shared/theme/theme.js and shared/i18n/i18n.js.

const KEYS = {
  startView: "smartloo.startView",
  startRadius: "smartloo.startRadius",
  mapsApp: "smartloo.mapsApp",
  reduceMotion: "smartloo.reduceMotion",
  mobileFilters: "smartloo.mobileFilters",
};

export const RADII = [500, 1000, 2500, 5000, 10000];
export const MAPS_APPS = ["ask", "apple", "google", "yandex"];

function get(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function set(key, value) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, String(value));
  } catch {
    // Storage blocked: the choice applies to this page only.
  }
}

/** "city" (İstanbul geneli, default) or "nearby" (Yakınımda). */
export const loadStartView = () => (get(KEYS.startView) === "nearby" ? "nearby" : "city");
export const saveStartView = (view) => set(KEYS.startView, view === "nearby" ? "nearby" : null);

export function loadStartRadius() {
  const value = Number(get(KEYS.startRadius));
  return RADII.includes(value) ? value : 1000;
}
export const saveStartRadius = (meters) => set(KEYS.startRadius, meters === 1000 ? null : meters);

/** "ask" (default: choose every time) or a remembered maps app. */
export function loadMapsApp() {
  const value = get(KEYS.mapsApp);
  return MAPS_APPS.includes(value) ? value : "ask";
}
export const saveMapsApp = (app) => set(KEYS.mapsApp, app === "ask" ? null : app);

export const loadReduceMotion = () => get(KEYS.reduceMotion) === "on";
export function saveReduceMotion(on) {
  set(KEYS.reduceMotion, on ? "on" : null);
  applyReduceMotion(on);
}
/** <html data-motion="reduce"> switches animations off (theme.css); the OS setting still applies on its own. */
export function applyReduceMotion(on) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.motion = "reduce";
  else delete document.documentElement.dataset.motion;
}

/** Phone filter row: closed unless the user opened it last time. */
export const loadMobileFiltersOpen = () => get(KEYS.mobileFilters) === "open";
export const saveMobileFiltersOpen = (open) => set(KEYS.mobileFilters, open ? "open" : null);

export function formatRadius(meters) {
  return meters >= 1000 ? `${String(meters / 1000).replace(".", ",")} km` : `${meters} m`;
}
