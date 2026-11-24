// FR-10 / TC-27: an ADMIN changes a facility's status from its detail panel
// (PATCH /api/v1/admin/toilets/{id}, #94). Closing never deletes: reviews and scores stay,
// new reviews are refused and "Şu an açık" no longer lists it. Shown only to ADMIN;
// the server checks the role again. Success is shown only after the server confirms.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { useMapApi } from "./MapApiProvider.jsx";
import { FACILITY_STATUSES, facilityStatusErrorMessage, setFacilityStatus } from "../admin/moderation/moderationApi.js";
import "./adminFacilityStatus.css";

const LABELS = { ACTIVE: "Aktif", MAINTENANCE: "Bakımda", CLOSED: "Kapalı" };
const EFFECTS = {
  ACTIVE: "Tesis yeniden aktif olur; yorum alır ve çalışma saatine göre “Şu an açık” aramasında görünebilir.",
  MAINTENANCE: "Tesis bakımda görünür; yorumlar ve puanlar korunur, “Şu an açık” aramasında listelenmez.",
  CLOSED: "Tesis kapatılır ama silinmez; yorumlar ve puanlar korunur, yeni yorum alınmaz ve “Şu an açık” aramasında listelenmez.",
};

export default function AdminFacilityStatus({ toiletId, status, onChanged }) {
  const { t } = useI18n();
  const { getCurrentSessionUser, request } = useMapApi();
  const user = getCurrentSessionUser?.();
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: "ok" | "error", text, vars }
  const confirmRef = useRef(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    if (target) confirmRef.current?.focus();
  }, [target]);

  useEffect(() => {
    ++requestGeneration.current;
    setTarget(null);
    setMessage(null);
    setBusy(false);
    return () => { ++requestGeneration.current; };
  }, [toiletId]);

  if (!user || user.role !== "ADMIN" || !request || !toiletId) return null;

  async function apply() {
    const generation = requestGeneration.current;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await setFacilityStatus({ request }, toiletId, target);
      if (generation !== requestGeneration.current) return;
      setMessage({ kind: "ok", text: "Tesis durumu “{status}” olarak kaydedildi.", vars: { status: LABELS[saved.status] } });
      onChanged?.();
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setMessage({ kind: "error", text: facilityStatusErrorMessage(error) });
      if (error?.status !== 401 && error?.status !== 403) onChanged?.();
    } finally {
      if (generation === requestGeneration.current) {
        setBusy(false);
        setTarget(null);
      }
    }
  }

  const current = FACILITY_STATUSES.includes(status) ? status : null;

  return (
    <section className="sl-admin-status" aria-label={t("Yönetici: tesis durumu")}>
      <p className="sl-admin-status-title">{t("Yönetici: tesis durumu")}</p>
      <div className="sl-admin-status-choices" role="radiogroup" aria-label={t("Tesis durumu")}>
        {FACILITY_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={current === key}
            disabled={busy}
            onClick={() => { if (key !== current) { setTarget(key); setMessage(null); } }}
          >
            {t(LABELS[key])}
          </button>
        ))}
      </div>

      {target && (
        <div
          ref={confirmRef}
          className={`sl-admin-status-confirm${target === "CLOSED" ? " is-danger" : ""}`}
          role="group"
          aria-label={t("Durum değişikliğini onaylayın")}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape" && !busy) setTarget(null); }}
        >
          <p>{t(EFFECTS[target])}</p>
          <div className="sl-admin-status-actions">
            <button type="button" className="sl-admin-status-primary" onClick={apply} disabled={busy} aria-busy={busy}>
              {busy ? t("Kaydediliyor…") : t("“{status}” yap", { status: t(LABELS[target]) })}
            </button>
            <button type="button" className="sl-admin-status-secondary" onClick={() => setTarget(null)} disabled={busy}>{t("Vazgeç")}</button>
          </div>
        </div>
      )}

      {message && (
        <p className={`sl-admin-status-message is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {t(message.text, message.vars && { status: t(message.vars.status) })}
        </p>
      )}
    </section>
  );
}
