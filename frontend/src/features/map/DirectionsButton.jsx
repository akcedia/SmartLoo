// "Yol tarifi al" for the selected facility.
// - A maps app saved as default (Settings, or "Bu seçimi varsayılan yap" below) opens directly.
// - Otherwise on Android: a plain geo: link, so the phone's own chooser asks which app to use.
// - Otherwise on iPhone/iPad, Mac and desktops: a small menu of maps apps (iOS has no
//   system chooser for maps), with the option to remember the choice.
// Only the facility's coordinates and name are sent; see directions.js.
import { useEffect, useId, useRef, useState } from "react";
import { detectPlatform, directionsOptions } from "./directions.js";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { loadMapsApp, saveMapsApp } from "../../shared/settings/preferences.js";
import "./directions.css";

function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 11l18-8-8 18-2-8-8-2z" />
    </svg>
  );
}

export default function DirectionsButton({ latitude, longitude, name, platform: platformProp }) {
  const platform = platformProp ?? detectPlatform();
  const { geo, providers } = directionsOptions({ lat: latitude, lon: longitude, name }, platform);
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mapsApp, setMapsApp] = useState(loadMapsApp);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const rememberId = useId();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    rootRef.current?.querySelector(".sl-directions-menu a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!providers.length) {
    return <p className="sl-directions-missing">{t("Bu tesisin konumu kayıtlı olmadığı için yol tarifi verilemiyor.")}</p>;
  }

  const saved = mapsApp !== "ask" ? providers.find((p) => p.id === mapsApp) : null;
  if (saved) {
    return (
      <div className="sl-directions">
        <a className="sl-directions-button" href={saved.href} target="_blank" rel="noopener noreferrer">
          <RouteIcon /> {t("Yol tarifi al")}
          <span className="app-sr"> ({t(saved.label)})</span>
        </a>
        <p className="sl-directions-note">
          {t("{app} ile açılır.", { app: t(saved.label) })}{" "}
          <button type="button" className="sl-directions-link" onClick={() => { saveMapsApp("ask"); setMapsApp("ask"); }}>
            {t("Başka uygulama seç")}
          </button>
        </p>
      </div>
    );
  }

  if (geo) {
    return (
      <div className="sl-directions">
        <a className="sl-directions-button" href={geo}>
          <RouteIcon /> {t("Yol tarifi al")}
        </a>
        <p className="sl-directions-note">{t("Telefonunuz hangi harita uygulamasıyla açılacağını soracak.")}</p>
      </div>
    );
  }

  function choose(provider) {
    if (remember) {
      saveMapsApp(provider.id);
      setMapsApp(provider.id);
    }
    setOpen(false);
  }

  return (
    <div className="sl-directions" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="sl-directions-button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <RouteIcon /> {t("Yol tarifi al")}
      </button>
      {open && (
        <div id={menuId} className="sl-directions-menu" role="group" aria-label={t("Harita uygulaması seçin")}>
          <p className="sl-directions-menu-title">{t("Hangi uygulamayla açılsın?")}</p>
          <ul>
            {providers.map((p) => (
              <li key={p.id}>
                <a href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => choose(p)}>
                  {t(p.label)}
                  <span className="app-sr"> ({t("yeni sekmede veya uygulamada açılır")})</span>
                </a>
              </li>
            ))}
          </ul>
          <label className="sl-directions-remember" htmlFor={rememberId}>
            <input id={rememberId} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t("Bu seçimi varsayılan yap")}
          </label>
          <button type="button" className="sl-directions-cancel" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>
            {t("Vazgeç")}
          </button>
        </div>
      )}
      <p className="sl-directions-note">{t("Yalnızca tesisin konumu gönderilir; başlangıç noktasını harita uygulaması belirler.")}</p>
    </div>
  );
}
