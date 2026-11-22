// Language context for every screen. Changing the language re-renders text only:
// session, filters, the selected facility and form input stay as they are.
//
//   const { t, lang, locale } = useI18n();
//   <h2>{t("Yorumlar")}</h2>
//   {t("{n} değerlendirme", { n: count })}
//   number.toLocaleString(locale)
//
// Without a provider (isolated component tests) useI18n() returns Turkish.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadLang, LOCALES, saveLang, translate } from "./i18n.js";

const fallback = {
  lang: "tr",
  locale: LOCALES.tr,
  setLang: () => {},
  t: (text, vars) => translate("tr", text, vars),
};

const I18nContext = createContext(fallback);

export function I18nProvider({ initialLang, children }) {
  const [lang, setLangState] = useState(() => initialLang ?? loadLang());

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    saveLang(next);
    setLangState(next);
  }, []);

  const value = useMemo(
    () => ({ lang, locale: LOCALES[lang], setLang, t: (text, vars) => translate(lang, text, vars) }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
