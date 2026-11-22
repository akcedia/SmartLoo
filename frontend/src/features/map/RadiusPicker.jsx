// Compact "1 km ▾" button next to "Yakınımda". Opens a short list of distances;
// choosing one switches to nearby search and closes the list again.
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { formatRadius, RADII } from "../../shared/settings/preferences.js";

export default function RadiusPicker({ radius, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector('[aria-checked="true"]')?.focus();
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

  function pick(value) {
    onChange(value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="sl-radius" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="sl-radius-button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("Arama yarıçapı: {radius}", { radius: formatRadius(radius) })}
        onClick={() => setOpen((v) => !v)}
      >
        {formatRadius(radius)}
        <svg className="sl-radius-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={listId} className="sl-radius-menu" role="radiogroup" aria-label={t("Arama yarıçapı")}>
          {RADII.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={radius === value} onClick={() => pick(value)}>
              {formatRadius(value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
