// Header language switch. Shows the language you switch TO, labelled in that
// language (lang attribute), as language pickers usually do.
import { useI18n } from "./I18nProvider.jsx";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const next = lang === "tr" ? "en" : "tr";
  return (
    <button
      type="button"
      className="app-lang-toggle"
      onClick={() => setLang(next)}
      lang={next}
      aria-label={next === "en" ? "Switch to English" : "Türkçeye geç"}
    >
      {next.toUpperCase()}
    </button>
  );
}
