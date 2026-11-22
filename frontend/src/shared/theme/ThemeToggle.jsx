// Header theme switch: Sistem → Açık → Koyu. The label always names the current
// choice and the next one, so the button is understandable without seeing the icon.
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { applyTheme, loadPreference, nextPreference, resolveTheme, savePreference, watchSystemTheme } from "./theme.js";

const LABELS = { system: "Sistem", light: "Açık", dark: "Koyu" };

function Icon({ preference }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
  if (preference === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (preference === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [preference, setPreference] = useState(loadPreference);
  const { t } = useI18n();

  useEffect(() => {
    applyTheme(resolveTheme(preference));
    if (preference !== "system") return undefined;
    return watchSystemTheme((theme) => applyTheme(theme, { animate: true }));
  }, [preference]);

  function change() {
    const next = nextPreference(preference);
    savePreference(next);
    applyTheme(resolveTheme(next), { animate: true });
    setPreference(next);
  }

  const next = nextPreference(preference);
  return (
    <button
      type="button"
      className="app-theme-toggle"
      onClick={change}
      aria-label={t("Tema: {current}. {next} temaya geç", { current: t(LABELS[preference]), next: t(LABELS[next]) })}
      title={t("Tema: {current}", { current: t(LABELS[preference]) })}
    >
      <Icon preference={preference} />
      <span className="app-theme-label" aria-hidden="true">{t(LABELS[preference])}</span>
    </button>
  );
}
