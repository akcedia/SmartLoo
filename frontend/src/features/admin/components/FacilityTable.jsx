import { isCritical } from "../api/contract.js";
import { formatScore } from "./KpiCards.jsx";

const STATUS_LABELS = { ACTIVE: "Aktif", CLOSED: "Kapalı", MAINTENANCE: "Bakımda" };

export default function FacilityTable({ rows }) {
  if (rows.length === 0) return <p className="admin-empty">Bu seçimde tesis yok.</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption>Seçilen dönemde tesis bazında hijyen</caption>
        <thead>
          <tr>
            <th scope="col">Tesis</th>
            <th scope="col">İlçe</th>
            <th scope="col">Durum</th>
            <th scope="col">Hijyen puanı</th>
            <th scope="col">Değerlendirme</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const score = formatScore(r.hygiene_score);
            return (
              <tr key={r.facility_id}>
                <th scope="row">{r.name ?? r.facility_id}</th>
                <td>{r.district}</td>
                <td>{STATUS_LABELS[r.status] ?? "Bilinmiyor"}</td>
                <td className={isCritical(r.hygiene_score) ? "admin-cell--critical" : undefined}>
                  {score ?? "Veri yok"}
                  {isCritical(r.hygiene_score) && <span className="admin-sr"> (kritik)</span>}
                </td>
                <td>{r.review_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
