import { useEffect, useId, useRef, useState } from "react";
import { Link, signInPath } from "./router.jsx";
import { useI18n } from "../shared/i18n/I18nProvider.jsx";

const ROLE_LABELS = { ADMIN: "Yönetici", USER: "Kullanıcı" };

// Header "Sign in or Account" control (UI Spec Lite). Shows the real session
// from the shared SessionProvider; the token itself is never displayed.
// Disclosure pattern (button + aria-expanded, plain links inside): it closes on
// Escape, on an outside click and when keyboard focus leaves it.
export default function AccountMenu({ session, onSignOut, returnTo }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) {
    return (
      <Link className="app-signin" to={signInPath(returnTo)}>{t("Giriş yap")}</Link>
    );
  }

  const name = session.email.split("@")[0];
  const initials = name.slice(0, 2).toLocaleUpperCase("tr-TR");
  const role = t(ROLE_LABELS[session.role] ?? session.role);

  return (
    <div
      className="app-account"
      ref={rootRef}
      onBlur={(e) => {
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="app-account-button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="app-avatar" aria-hidden="true">{initials}</span>
        <span className="app-account-name">{name}</span>
        <span className="app-role-badge">{role}</span>
        <span className="app-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={menuId} className="app-account-menu">
          <p className="app-account-status">
            <span className="app-dot" aria-hidden="true" />
            {session.email} · {role}
          </p>
          <Link to="/account" onClick={() => setOpen(false)}>{t("Hesabım")}</Link>
          {session.role === "ADMIN" && <Link to="/admin" onClick={() => setOpen(false)}>{t("Yönetim paneli")}</Link>}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            {t("Çıkış yap")}
          </button>
        </div>
      )}
    </div>
  );
}
