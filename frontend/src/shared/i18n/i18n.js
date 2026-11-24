// Shared TR/EN language structure (NFR-10). The Turkish text itself is the key:
//   t("Giriş yap")                         → "Sign in" in English
//   t("{n} değerlendirme", { n: 3 })       → "3 reviews"
// A Turkish string without an English entry is shown in Turkish, so wrapping a
// string in t() never breaks a screen. Catalog: ./en.js.
import EN from "./en.js";

export const LANG_KEY = "smartloo.lang";
export const LANGS = ["tr", "en"];
export const LOCALES = { tr: "tr-TR", en: "en-GB" };
const CATALOGS = { en: EN };

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Turkish is the default; English only when the user picked it. */
export function loadLang() {
  try {
    const value = storage()?.getItem(LANG_KEY);
    return LANGS.includes(value) ? value : "tr";
  } catch {
    return "tr";
  }
}

export function saveLang(lang) {
  try {
    if (lang === "tr") storage()?.removeItem(LANG_KEY);
    else storage()?.setItem(LANG_KEY, lang);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
}

function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function translate(lang, text, vars) {
  if (typeof text !== "string") return text;
  const catalog = CATALOGS[lang];
  return fill(catalog?.[text] ?? text, vars);
}

/** Keys used in the catalog but whose Turkish template no longer exists are found by i18n.test. */
export function catalog(lang) {
  return CATALOGS[lang] ?? {};
}
