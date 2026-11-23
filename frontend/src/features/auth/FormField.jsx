import { useId } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";

// Labelled input with a persistent label, hint and inline error (UI Spec Lite).
export default function FormField({ label, error, hint, ...inputProps }) {
  const id = useId();
  const { t } = useI18n();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="app-field">
      <label htmlFor={id}>{t(label)}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      {hint && <p id={`${id}-hint`} className="app-field-hint">{t(hint)}</p>}
      {error && <p id={`${id}-error`} className="app-field-error">{t(error)}</p>}
    </div>
  );
}
