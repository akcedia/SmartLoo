import { CRITICAL_ALERT_TEXT, CRITICAL_THRESHOLD } from "../api/contract.js";

export function formatScore(value) {
  return value === null || value === undefined ? null : value.toFixed(2);
}

export default function KpiCards({ data }) {
  const average = formatScore(data.average_cleanliness);
  const ratio = data.active_facility_ratio;
  const threshold = data.critical_threshold ?? CRITICAL_THRESHOLD;

  return (
    <section className="admin-kpis" aria-label="Özet göstergeler">
      <div className={`admin-card${data.critical_alert ? " admin-card--critical" : ""}`}>
        <h3>Ortalama hijyen</h3>
        {average === null ? (
          <p className="admin-kpi admin-kpi--empty">Veri yok</p>
        ) : (
          <p className="admin-kpi">{average} <small>/ 5</small></p>
        )}
        <p className="admin-card-note">Seçilen dönemdeki tüm değerlendirmelerin ortalaması</p>
      </div>

      <div className="admin-card">
        <h3>Değerlendirme sayısı</h3>
        <p className="admin-kpi">{data.review_count}</p>
      </div>

      <div className="admin-card">
        <h3>Aktif tesis oranı</h3>
        {ratio ? (
          <p className="admin-kpi">
            {ratio.total === 0 ? "—" : `%${Math.round((ratio.active / ratio.total) * 100)}`}{" "}
            <small>({ratio.active}/{ratio.total})</small>
          </p>
        ) : (
          <p className="admin-kpi admin-kpi--empty">Bilinmiyor</p>
        )}
        <p className="admin-card-note">İdari durum (ACTIVE); anlık doluluk değildir</p>
      </div>

      {data.critical_alert && (
        <div className="admin-alert" role="alert">
          <strong>⚠ {CRITICAL_ALERT_TEXT}</strong>
          <span>Ortalama {average}, eşik {threshold} değerinin altında.</span>
        </div>
      )}
    </section>
  );
}
