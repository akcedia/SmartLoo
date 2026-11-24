import { CRITICAL_ALERT_TEXT, CRITICAL_THRESHOLD } from "../api/contract.js";
import { useI18n } from "../../../shared/i18n/I18nProvider.jsx";

export function formatScore(value) {
  return value === null || value === undefined ? null : value.toFixed(2);
}

export default function KpiCards({ data }) {
  const average = formatScore(data.average_cleanliness);
  const ratio = data.active_facility_ratio;
  const threshold = data.critical_threshold ?? CRITICAL_THRESHOLD;
  const { t } = useI18n();

  return (
    <section className="admin-kpis" aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="admin-sr">{t("Özet göstergeler")}</h2>
      <div className={`admin-card${data.critical_alert ? " admin-card--critical" : ""}`}>
        <h3>{t("Ortalama hijyen")}</h3>
        {average === null ? (
          <p className="admin-kpi admin-kpi--empty">{t("Veri yok")}</p>
        ) : (
          <p className="admin-kpi">{average} <small>/ 5</small></p>
        )}
        <p className="admin-card-note">{t("Seçilen dönemdeki tüm değerlendirmelerin ortalaması")}</p>
      </div>

      <div className="admin-card">
        <h3>{t("Değerlendirme sayısı")}</h3>
        <p className="admin-kpi">{data.review_count}</p>
      </div>

      <div className="admin-card">
        <h3>{t("Aktif tesis oranı")}</h3>
        {ratio ? (
          <p className="admin-kpi">
            {ratio.total === 0 ? "—" : t("%{n}", { n: Math.round((ratio.active / ratio.total) * 100) })}{" "}
            <small>({ratio.active}/{ratio.total})</small>
          </p>
        ) : (
          // null means either no matched facility or unknown status data (contract §2.1, §2.3).
          <p className="admin-kpi admin-kpi--empty">{data.facilities?.length === 0 ? t("Tesis yok") : t("Bilinmiyor")}</p>
        )}
        <p className="admin-card-note">{t("İdari durum (ACTIVE); anlık doluluk değildir")}</p>
      </div>

      {data.critical_alert && (
        <div className="admin-alert" role="alert">
          <strong>⚠ {t(CRITICAL_ALERT_TEXT)}</strong>
          <span>{t("Ortalama {average}, eşik {threshold} değerinin altında.", { average, threshold })}</span>
        </div>
      )}
    </section>
  );
}
