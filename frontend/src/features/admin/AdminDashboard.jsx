// Administration > Analytics tab (FR-06, FR-07 export).
// Runs on the labelled sample adapter until the backend endpoints exist.
// Hiding this route from non-admins is UX only; the backend must enforce RBAC.

import { useMemo, useRef, useState } from "react";
import { createSampleAdapter, SCENARIOS } from "./api/sampleAdapter.js";
import { presetRange, validateRange } from "./api/dateRange.js";
import { useDashboardData } from "./useDashboardData.js";
import FilterBar from "./components/FilterBar.jsx";
import KpiCards from "./components/KpiCards.jsx";
import TrendChart from "./components/TrendChart.jsx";
import FacilityTable from "./components/FacilityTable.jsx";
import ExportButtons from "./components/ExportButtons.jsx";
import { ErrorPanel, LoadingPanel, NoDataPanel } from "./components/StatusPanel.jsx";
import "./admin.css";

function useSampleAdapter() {
  const scenarioRef = useRef("normal");
  const [scenario, setScenarioState] = useState("normal");
  const adapter = useMemo(() => createSampleAdapter({ getScenario: () => scenarioRef.current }), []);
  const setScenario = (value) => {
    scenarioRef.current = value;
    setScenarioState(value);
  };
  return { adapter, scenario, setScenario };
}

export default function AdminDashboard({ adapter: injectedAdapter }) {
  const sample = useSampleAdapter();
  const adapter = injectedAdapter ?? sample.adapter;

  const [filters, setFilters] = useState(() => ({ district: "", preset: "last30", ...presetRange("last30") }));
  const errors = validateRange(filters);
  const valid = Object.keys(errors).length === 0;
  const query = { district: filters.district || null, from: filters.from, to: filters.to };
  const { status, data, error, reload } = useDashboardData(adapter, query, valid);

  function handleFilterChange(change) {
    setFilters((current) => {
      const next = { ...current, ...change };
      if (change.preset && change.preset !== "custom") Object.assign(next, presetRange(change.preset));
      return next;
    });
  }

  function handleScenarioChange(value) {
    sample.setScenario(value);
    reload();
  }

  const hasData = data && data.review_count > 0;

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <h1>Yönetim Paneli</h1>
          <p className="admin-subtitle">Analiz · ilçe ve tarih bazlı hijyen</p>
        </div>
        <a href="#/">← Haritaya dön</a>
      </header>

      {adapter.isSample && (
        <aside className="admin-sample-banner" role="note">
          <strong>ÖRNEK VERİ</strong> — Bu ekran backend'e bağlı değildir. Tesis adları, puanlar ve tarihler
          arayüz incelemesi için uydurulmuştur. Yetkilendirme (RBAC) uygulanmamıştır.
          <label>
            Demo senaryosu
            <select value={sample.scenario} onChange={(e) => handleScenarioChange(e.target.value)}>
              {Object.entries(SCENARIOS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
        </aside>
      )}

      <FilterBar {...filters} errors={errors} onChange={handleFilterChange} />

      {!valid && <p className="admin-empty">Geçerli bir tarih aralığı seçildiğinde veriler yüklenecek.</p>}
      {valid && status === "loading" && !data && <LoadingPanel />}
      {valid && status === "error" && <ErrorPanel error={error} onRetry={reload} />}
      {valid && data && status !== "error" && (
        <div className={status === "loading" ? "admin-content admin-content--stale" : "admin-content"} aria-busy={status === "loading"}>
          {status === "loading" && <LoadingPanel />}
          {hasData ? (
            <>
              <KpiCards data={data} />
              <section aria-label="Trend">
                <h2>Hijyen trendi</h2>
                <TrendChart trend={data.trend} threshold={data.critical_threshold} />
              </section>
              <section aria-label="Tesisler">
                <h2>Tesisler</h2>
                <FacilityTable rows={data.facilities} />
              </section>
            </>
          ) : (
            <>
              <KpiCards data={data} />
              <NoDataPanel />
            </>
          )}
          <ExportButtons adapter={adapter} filters={query} disabled={status === "loading"} />
        </div>
      )}
    </main>
  );
}
