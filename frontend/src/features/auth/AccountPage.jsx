// Account Privacy screen (UI Spec Lite, FR-10 with FR-08).
// Explains what deletion does, asks for an explicit confirmation and reports
// success only after the server answers 204. No extra password prompt is
// added: the requirements do not specify re-authentication.

import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import { navigate } from "../../app/router.jsx";
import { deleteAccount, deletionErrorMessage } from "./accountDeletion.js";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";

const ROLE_LABELS = { ADMIN: "Yönetici", USER: "Kullanıcı" };

export default function AccountPage({ initialStep = "idle" }) {
  const { session, api, signOut, endSession } = useSession();
  const { t } = useI18n();
  const [step, setStep] = useState(initialStep); // idle | confirming | deleting
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const restoreFocus = useRef(false);
  const titleId = useId();
  const descId = useId();

  // Focus moves into the confirmation, and back to "Hesabımı sil" once it is
  // rendered again (the button does not exist while the confirmation is open).
  useEffect(() => {
    if (step === "confirming") dialogRef.current?.focus();
    if (step === "idle" && restoreFocus.current) {
      restoreFocus.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [step]);

  function cancel() {
    restoreFocus.current = true;
    setStep("idle");
  }

  async function confirmDeletion() {
    setStep("deleting");
    setError(null);
    try {
      await deleteAccount(api);
      endSession("Hesabınız silindi. Yorumlarınız “Anonim” olarak kalır.");
      navigate("/", { replace: true });
    } catch (err) {
      // A 401 already ended the session through the shared client.
      setError(deletionErrorMessage(err));
      restoreFocus.current = true;
      setStep("idle");
    }
  }

  if (!session) return null;

  const minutesLeft = Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000));
  const deleting = step === "deleting";

  return (
    <main className="app-page app-narrow">
      <h1>{t("Hesabım")}</h1>
      <dl className="app-details">
        <dt>{t("E-posta")}</dt>
        <dd>{session.email}</dd>
        <dt>{t("Rol")}</dt>
        <dd>{t(ROLE_LABELS[session.role] ?? session.role)}</dd>
        <dt>{t("Oturum")}</dt>
        <dd>{t("Yaklaşık {n} dakika sonra sona erer (60 dakikalık oturum).", { n: minutesLeft })}</dd>
      </dl>
      <button type="button" className="app-button app-button--secondary" onClick={signOut} disabled={deleting}>{t("Çıkış yap")}</button>

      <section className="app-danger-zone" aria-labelledby="delete-title">
        <h2 id="delete-title">{t("Hesabı sil")}</h2>
        <ul className="app-list">
          <li>{t("E-posta adresiniz, görünen adınız ve parola özetiniz kalıcı olarak silinir.")}</li>
          <li>{t("Yorumlarınız silinmez; “Anonim” olarak görünür ve puanlar istatistiklerde kalır.")}</li>
          <li>{t("Yorum metinlerinizdeki görünen adınız, e-posta adresleri ve tanınan telefon numaraları temizlenir.")}</li>
          <li>{t("Bu işlem geri alınamaz. Mevcut oturumunuz hemen geçersiz olur.")}</li>
        </ul>

        {error && <p className="app-alert app-alert--error" role="alert">{t(error)}</p>}

        {step === "idle" && (
          <button ref={deleteButtonRef} type="button" className="app-button app-button--danger" onClick={() => setStep("confirming")}>
            {t("Hesabımı sil")}
          </button>
        )}

        {step !== "idle" && (
          <div
            ref={dialogRef}
            className="app-confirm"
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !deleting) cancel();
            }}
          >
            <h3 id={titleId}>{t("Hesabınızı kalıcı olarak silmek istediğinize emin misiniz?")}</h3>
            <p id={descId}>{t("{email} hesabı silinecek. Bu işlem geri alınamaz.", { email: session.email })}</p>
            <div className="app-confirm-actions">
              <button type="button" className="app-button app-button--danger" onClick={confirmDeletion} disabled={deleting} aria-busy={deleting}>
                {deleting ? t("Siliniyor…") : t("Evet, hesabımı sil")}
              </button>
              <button type="button" className="app-button app-button--secondary" onClick={cancel} disabled={deleting}>
                {t("Vazgeç")}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
