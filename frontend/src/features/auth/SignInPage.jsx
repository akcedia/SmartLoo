// Sign In screen (UI Spec Lite, FR-08). POST /api/v1/auth/login via the shared session.

import { useRef, useState } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import { Link, navigate, safeReturnPath } from "../../app/router.jsx";
import FormField from "./FormField.jsx";
import { useFocusFirstError } from "./useFocusFirstError.js";
import { authErrorMessage, validateSignIn } from "./validation.js";

export default function SignInPage({ search = "" }) {
  const { session, signIn } = useSession();
  const params = new URLSearchParams(search);
  const next = safeReturnPath(params.get("next"));
  const registered = params.get("registered") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null);
  useFocusFirstError(formRef, attempt);

  if (session) {
    return (
      <main className="app-page app-narrow">
        <h1>Giriş yapıldı</h1>
        <p>{session.email} olarak oturum açtınız.</p>
        <p><Link to={next}>Devam et</Link></p>
      </main>
    );
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateSignIn(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      setAttempt((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      await signIn(form.email, form.password);
      navigate(next, { replace: true });
    } catch (error) {
      setErrors(error.fieldErrors ?? {});
      setFormError(authErrorMessage(error, "sign-in"));
      setForm((f) => ({ ...f, password: "" }));
      setBusy(false);
      setAttempt((n) => n + 1);
    }
  }

  return (
    <main className="app-page app-narrow">
      <h1>Giriş yap</h1>
      {registered && (
        <p className="app-alert app-alert--ok" role="status">Hesabınız oluşturuldu. Şimdi giriş yapabilirsiniz.</p>
      )}
      <form ref={formRef} className="app-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
        {formError && <p className="app-alert app-alert--error" role="alert">{formError}</p>}
        <FormField label="E-posta" type="email" name="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <FormField label="Parola" type="password" name="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} required />
        <button type="submit" className="app-button" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
      </form>
      <p className="app-muted">
        Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
      </p>
    </main>
  );
}
