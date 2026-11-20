// Register screen (UI Spec Lite, FR-08). No role selector: registration always creates USER (TC-48).
// Success leads to Sign In; registration does not issue a token.

import { useState } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import { Link, navigate } from "../../app/router.jsx";
import FormField from "./FormField.jsx";
import { authErrorMessage, validateRegistration } from "./validation.js";

const PASSWORD_HINT = "En az 8 karakter, en az bir harf ve bir rakam.";

export default function RegisterPage() {
  const { register } = useSession();
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateRegistration(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await register({ display_name: form.display_name.trim(), email: form.email.trim(), password: form.password });
      navigate("/sign-in?registered=1", { replace: true });
    } catch (error) {
      setErrors(error.status === 409 ? { email: authErrorMessage(error, "register") } : error.fieldErrors ?? {});
      setFormError(authErrorMessage(error, "register"));
      setBusy(false);
    }
  }

  return (
    <main className="app-page app-narrow">
      <h1>Kayıt ol</h1>
      <form className="app-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
        {formError && <p className="app-alert app-alert--error" role="alert">{formError}</p>}
        <FormField label="Görünen ad" name="display_name" autoComplete="nickname" value={form.display_name} onChange={set("display_name")} error={errors.display_name} hint="3–30 karakter." required />
        <FormField label="E-posta" type="email" name="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <FormField label="Parola" type="password" name="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint={PASSWORD_HINT} required />
        <button type="submit" className="app-button" disabled={busy}>{busy ? "Hesap oluşturuluyor…" : "Hesap oluştur"}</button>
      </form>
      <p className="app-muted">
        Zaten hesabınız var mı? <Link to="/sign-in">Giriş yapın</Link>
      </p>
    </main>
  );
}
