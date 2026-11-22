import { isCritical } from "../api/contract.js";
import { formatScore } from "./KpiCards.jsx";
import { useI18n } from "../../../shared/i18n/I18nProvider.jsx";

const STATUS_LABELS = { ACTIVE: "Aktif", CLOSED: "Kapalı", MAINTENANCE: "Bakımda" };

// Explicit ARIA roles keep table semantics when the narrow-screen card layout
// switches the elements to display:block, which some browsers treat as "not a table".
export default function FacilityTable({ rows }) {
  const { t } = useI18n();
  if (rows === null) return <p className="admin-empty">{t("Sunucu bu yanıtta tesis listesini göndermedi.")}</p>;
  if (rows.length === 0) return <p className="admin-empty">{t("Bu seçimde tesis yok.")}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" role="table">
        <caption>{t("Seçilen dönemde tesis bazında hijyen")}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">{t("Tesis")}</th>
            <th scope="col" role="columnheader">{t("İlçe")}</th>
            <th scope="col" role="columnheader">{t("Durum")}</th>
            <th scope="col" role="columnheader">{t("Hijyen puanı")}</th>
            <th scope="col" role="columnheader">{t("Değerlendirme")}</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r) => {
            const score = formatScore(r.hygiene_score);
            return (
              <tr key={r.facility_id} role="row">
                <th scope="row" role="rowheader">{r.name ?? r.facility_id}</th>
                <td role="cell" data-label={t("İlçe")}>{r.district}</td>
                <td role="cell" data-label={t("Durum")}>
                  <span className={`admin-status-pill admin-status-pill--${r.status ?? "UNKNOWN"}`}>
                    {t(STATUS_LABELS[r.status] ?? "Bilinmiyor")}
                  </span>
                </td>
                <td role="cell" data-label={t("Hijyen puanı")} className={isCritical(r.hygiene_score) ? "admin-cell--critical" : undefined}>
                  {score ?? t("Veri yok")}
                  {isCritical(r.hygiene_score) && <span className="admin-sr"> ({t("kritik")})</span>}
                </td>
                <td role="cell" data-label={t("Değerlendirme")}>{r.review_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
