// Header "Ayarlar" (gear) menu: theme, language, how the map starts, the maps app
// used for directions and reduced motion. Disclosure pattern: a button with
// aria-expanded and a non-modal panel; Escape, an outside click or moving focus
// away closes it. All choices are stored in this browser only.
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { applyTheme, loadPreference, resolveTheme, savePreference, watchSystemTheme } from "../theme/theme.js";
import {
  formatRadius,
  loadMapsApp,
  loadReduceMotion,
  loadStartRadius,
  loadStartView,
  RADII,
  saveMapsApp,
  saveReduceMotion,
  saveStartRadius,
  saveStartView,
} from "./preferences.js";
import "./settings.css";

const THEMES = [
  ["system", "Sistem"],
  ["light", "Açık"],
  ["dark", "Koyu"],
];
const LANGUAGES = [
  ["tr", "Türkçe"],
  ["en", "English"],
];
const VIEWS = [
  ["city", "İstanbul geneli"],
  ["nearby", "Yakınımda"],
];
const MAPS = [
  ["ask", "Her seferinde sor"],
  ["apple", "Apple Haritalar"],
  ["google", "Google Haritalar"],
  ["yandex", "Yandex Haritalar"],
];

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function Choice({ label, options, value, onChange, t }) {
  return (
    <div className="sl-setting">
      <span className="sl-setting-label">{t(label)}</span>
      <div className="sl-setting-choices" role="radiogroup" aria-label={t(label)}>
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            lang={key === "en" ? "en" : key === "tr" ? "tr" : undefined}
          >
            {key === "en" || key === "tr" ? text : t(text)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsMenu() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(loadPreference);
  const [view, setView] = useState(loadStartView);
  const [radius, setRadius] = useState(loadStartRadius);
  const [mapsApp, setMapsApp] = useState(loadMapsApp);
  const [reduceMotion, setReduceMotion] = useState(loadReduceMotion);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const radiusId = useId();
  const motionId = useId();
  const mapsId = useId();

  // The theme follows the OS while "Sistem" is chosen.
  useEffect(() => {
    applyTheme(resolveTheme(theme));
    if (theme !== "system") return undefined;
    return watchSystemTheme((resolved) => applyTheme(resolved, { animate: true }));
  }, [theme]);

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector(".sl-settings-panel button")?.focus();
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Another tab or the directions button may change the maps app; re-read on open.
  useEffect(() => {
    if (open) setMapsApp(loadMapsApp());
  }, [open]);

  function changeTheme(next) {
    savePreference(next);
    applyTheme(resolveTheme(next), { animate: true });
    setTheme(next);
  }

  return (
    <div
      className="sl-settings"
      ref={rootRef}
      onBlur={(e) => {
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="sl-settings-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("Ayarlar")}
        title={t("Ayarlar")}
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
      </button>
      {open && (
        <div id={panelId} className="sl-settings-panel" role="group" aria-label={t("Ayarlar")}>
          <p className="sl-settings-title">{t("Ayarlar")}</p>

          <Choice t={t} label="Tema" options={THEMES} value={theme} onChange={changeTheme} />
          <Choice t={t} label="Dil" options={LANGUAGES} value={lang} onChange={setLang} />

          <div className="sl-setting-divider" />
          <Choice
            t={t}
            label="Harita açılınca"
            options={VIEWS}
            value={view}
            onChange={(next) => { saveStartView(next); setView(next); }}
          />
          <div className="sl-setting sl-setting--inline">
            <label htmlFor={radiusId} className="sl-setting-label">{t("Varsayılan yarıçap")}</label>
            <select
              id={radiusId}
              value={radius}
              onChange={(e) => { const next = Number(e.target.value); saveStartRadius(next); setRadius(next); }}
            >
              {RADII.map((value) => <option key={value} value={value}>{formatRadius(value)}</option>)}
            </select>
          </div>

          <div className="sl-setting sl-setting--inline">
            <label htmlFor={mapsId} className="sl-setting-label">{t("Yol tarifi uygulaması")}</label>
            <select id={mapsId} value={mapsApp} onChange={(e) => { saveMapsApp(e.target.value); setMapsApp(e.target.value); }}>
              {MAPS.map(([key, text]) => <option key={key} value={key}>{t(text)}</option>)}
            </select>
          </div>

          <div className="sl-setting-divider" />
          <div className="sl-setting sl-setting--inline">
            <label htmlFor={motionId} className="sl-setting-label">{t("Hareketi azalt")}</label>
            <input
              id={motionId}
              type="checkbox"
              role="switch"
              className="sl-switch"
              checked={reduceMotion}
              onChange={(e) => { saveReduceMotion(e.target.checked); setReduceMotion(e.target.checked); }}
            />
          </div>
          <p className="sl-settings-note">{t("Ayarlar yalnızca bu tarayıcıda saklanır.")}</p>
        </div>
      )}
    </div>
  );
}
