import { useEffect, useRef, useState } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { Link } from "../../app/router.jsx";
import FormField from "../auth/FormField.jsx";
import { useFocusFirstError } from "../auth/useFocusFirstError.js";

const EMPTY = { name: "", district: "", latitude: "", longitude: "",
  has_disabled_access: "", has_baby_changing: "", is_free: "" };

export function validateSuggestion(form) {
  const errors = {};
  if (!form.name.trim() || form.name.trim().length > 150) errors.name = "Tesis adı 1–150 karakter olmalı.";
  if (!form.district.trim() || form.district.trim().length > 100) errors.district = "İlçe 1–100 karakter olmalı.";
  for (const [field, max] of [["latitude", 90], ["longitude", 180]]) {
    if (!String(form[field]).trim() || !Number.isFinite(Number(form[field])) || Math.abs(Number(form[field])) > max) {
      errors[field] = field === "latitude" ? "Enlem −90 ile 90 arasında olmalı." : "Boylam −180 ile 180 arasında olmalı.";
    }
  }
  return errors;
}

export default function SuggestionPage() {
  const { api } = useSession();
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null), sending = useRef(false), active = useRef(true);
  useFocusFirstError(formRef, attempt);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const set = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (sending.current || saved || uncertain) return;
    const found = validateSuggestion(form);
    setErrors(found); setMessage("");
    if (Object.keys(found).length) { setAttempt((n) => n + 1); return; }
    sending.current = true; setBusy(true);
    try {
      const body = { name: form.name.trim(), district: form.district.trim(),
        latitude: Number(form.latitude), longitude: Number(form.longitude) };
      for (const field of ["has_disabled_access", "has_baby_changing", "is_free"]) {
        body[field] = form[field] === "" ? null : form[field] === "true";
      }
      const response = await api.request("/api/v1/toilets/suggest", { method: "POST", body, raw: true });
      const data = await response.json();
      if (response.status !== 202 || data?.status !== "pending" || !data.id) throw { status: 0 };
      if (active.current) setSaved(true);
    } catch (error) {
      if (!active.current) return;
      if (error.status === 422) setMessage("Öneri doğrulanamadı. Tesis adını, ilçeyi ve koordinatları kontrol edin.");
      else if (error.status === 401) setMessage("Oturumunuz sona erdi. Yeniden giriş yapın.");
      else if (error.status === 403) setMessage("Bu işlem için yetkiniz yok.");
      else {
        setUncertain(true);
        setMessage("Önerinin kaydedilip kaydedilmediği doğrulanamadı. Tekrar göndermeden önce yöneticiye kontrol ettirin.");
      }
      setAttempt((n) => n + 1);
    } finally {
      if (active.current) { sending.current = false; setBusy(false); }
    }
  }

  return <main className="app-page app-narrow">
    <h1>{t("Tesis öner")}</h1>
    <p>{t("Öneriniz yönetici onayından sonra haritada yayımlanır. Bilmediğiniz bilgileri bilinmiyor olarak bırakın.")}</p>
    {saved ? <p className="app-alert app-alert--ok" role="status">{t("Öneriniz alındı; yönetici onayı bekleniyor. Henüz haritada yayımlanmadı.")}</p> :
      <form className="app-form" ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
        {message && <p role="alert" className="app-alert app-alert--error">{t(message)}</p>}
        <fieldset disabled={busy || uncertain} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 14, minWidth: 0 }}>
          <legend className="app-sr">{t("Tesis bilgileri")}</legend>
          <FormField label="Tesis adı" name="name" value={form.name} onChange={set("name")} maxLength={150} error={errors.name} required />
          <FormField label="İlçe" name="district" value={form.district} onChange={set("district")} maxLength={100} error={errors.district} required />
          <FormField label="Enlem" name="latitude" type="number" step="any" min={-90} max={90} value={form.latitude} onChange={set("latitude")} error={errors.latitude} required />
          <FormField label="Boylam" name="longitude" type="number" step="any" min={-180} max={180} value={form.longitude} onChange={set("longitude")} error={errors.longitude} required />
          <p className="app-muted">{t("Koordinatlar önerdiğiniz tesise ait olmalı; kişisel konumunuz otomatik gönderilmez.")}</p>
          {[["has_disabled_access", "Engelli erişimi"], ["has_baby_changing", "Bebek bakım alanı"], ["is_free", "Ücretsiz mi?"]].map(([field, label]) =>
            <div className="app-field" key={field}><label htmlFor={`suggest-${field}`}>{t(label)}</label>
              <select id={`suggest-${field}`} name={field} value={form[field]} onChange={set(field)}>
                <option value="">{t("Bilinmiyor")}</option><option value="true">{t("Evet")}</option><option value="false">{t("Hayır")}</option>
              </select></div>)}
          <button className="app-button" type="submit">{busy ? t("Gönderiliyor…") : t("Öneriyi gönder")}</button>
        </fieldset>
      </form>}
    <p><Link to="/">{t("Haritaya dön")}</Link></p>
  </main>;
}
