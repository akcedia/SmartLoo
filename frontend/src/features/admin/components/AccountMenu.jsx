import { useEffect, useId, useRef, useState } from "react";

const ROLE_LABELS = { ADMIN: "Yönetici", USER: "Kullanıcı" };

// Header "Sign in or Account" control (UI Spec Lite, Discovery Map header).
// `session` is { displayName, role, isSample } or null when nobody is signed in.
// Real sign-in/sign-out does not exist yet; sample sessions are labelled as such.
export default function AccountMenu({ session }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

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
      <a className="admin-signin" href="#/sign-in">Giriş yap</a>
    );
  }

  const initials = session.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
  const role = ROLE_LABELS[session.role] ?? session.role;

  return (
    <div className="admin-account" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="admin-account-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="admin-avatar" aria-hidden="true">{initials}</span>
        <span className="admin-account-name">{session.displayName}</span>
        <span className="admin-role-badge">{role}</span>
        <span className="admin-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={menuId} className="admin-account-menu">
          <p className="admin-account-status">
            <span className="admin-dot" aria-hidden="true" />
            Oturum açık · {role}
            {session.isSample && <span className="admin-sample-tag">örnek oturum</span>}
          </p>
          <a href="#/account">Hesabım</a>
          <a href="#/">Haritaya dön</a>
          <button type="button" disabled title="Kimlik doğrulama henüz uygulanmadı">
            Çıkış yap
          </button>
          {session.isSample && (
            <p className="admin-account-note">Gerçek giriş/çıkış henüz yok; bu oturum demo senaryosundan gelir.</p>
          )}
        </div>
      )}
    </div>
  );
}
