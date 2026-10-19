// Administration > Analytics tab (FR-06, FR-07 export).
// Runs on the labelled sample adapter until the backend endpoints exist.
// Hiding this route from non-admins is UX only; the backend must enforce RBAC.

import { useMemo, useRef, useState } from "react";
import { createSampleAdapter, sampleSessionFor, SCENARIOS } from "./api/sampleAdapter.js";
import { presetRange, validateRange } from "./api/dateRange.js";
import { useDashboardData } from "./useDashboardData.js";
import AccountMenu from "./components/AccountMenu.jsx";
import FilterBar from "./components/FilterBar.jsx";
import KpiCards from "./components/KpiCards.jsx";
import TrendChart from "./components/TrendChart.jsx";
import FacilityTable from "./components/FacilityTable.jsx";
import ExportButtons from "./components/ExportButtons.jsx";
import { ErrorPanel, LoadingPanel, NoDataPanel, SkeletonPanel } from "./components/StatusPanel.jsx";
import "./admin.css";

// Tabs from UI Spec Lite > Administration. Only Analytics belongs to #29.
const TABS = [
  { key: "analytics", label: "Analiz" },
  { key: "moderation", label: "Moderasyon" },
  { key: "import", label: "İçe aktarım" },
];

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

export function formatDateTr(date) {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export default function AdminDashboard({ adapter: injectedAdapter, session: injectedSession }) {
  const sample = useSampleAdapter();
  const adapter = injectedAdapter ?? sample.adapter;
  const session = injectedAdapter ? injectedSession ?? null : sampleSessionFor(sample.scenario);

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
    <div className="admin">
      <header className="admin-topbar">
        <a className="admin-brand" href="#/">
          <span className="admin-brand-mark" aria-hidden="true">SL</span>
          SmartLoo
        </a>
        <nav className="admin-topnav" aria-label="Ana menü">
          <a href="#/">Harita</a>
          <a href="#/admin" aria-current="page">Yönetim</a>
        </nav>
        <AccountMenu session={session} />
      </header>

      <main className="admin-main">
        <div className="admin-heading">
          <h1>Yönetim Paneli</h1>
          <p className="admin-subtitle">İlçe ve tarih bazlı hijyen analizi</p>
        </div>

        <nav className="admin-tabs" aria-label="Yönetim bölümleri">
          {TABS.map((tab) =>
            tab.key === "analytics" ? (
              <span key={tab.key} className="admin-tab admin-tab--active" aria-current="page">{tab.label}</span>
            ) : (
              <span key={tab.key} className="admin-tab admin-tab--disabled" aria-disabled="true" title="Ayrı görevde geliştirilecek">
                {tab.label}
              </span>
            ),
          )}
        </nav>

        {adapter.isSample && (
          <aside className="admin-sample-banner" role="note">
            <div>
              <strong className="admin-sample-label">ÖRNEK VERİ</strong>
              Bu ekran backend'e bağlı değildir. Tesis adları, puanlar ve tarihler arayüz incelemesi için
              uydurulmuştur. Yetkilendirme (RBAC) uygulanmamıştır.
            </div>
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

        {valid && (
          <p className="admin-selection" aria-live="polite">
            Gösterilen: <strong>{filters.district || "Tüm ilçeler"}</strong> ·{" "}
            <strong>{formatDateTr(filters.from)} – {formatDateTr(filters.to)}</strong>
          </p>
        )}

        {!valid && <p className="admin-empty">Geçerli bir tarih aralığı seçildiğinde veriler yüklenecek.</p>}
        {valid && status === "loading" && !data && <SkeletonPanel />}
        {valid && status === "error" && <ErrorPanel error={error} onRetry={reload} />}
        {valid && data && status !== "error" && (
          <div className={status === "loading" ? "admin-content admin-content--stale" : "admin-content"} aria-busy={status === "loading"}>
            {status === "loading" && <LoadingPanel />}
            <KpiCards data={data} />
            {hasData ? (
              <div className="admin-grid">
                <section className="admin-panel" aria-labelledby="trend-title">
                  <h2 id="trend-title">Hijyen trendi</h2>
                  <TrendChart trend={data.trend} threshold={data.critical_threshold} />
                </section>
                <section className="admin-panel" aria-labelledby="facilities-title">
                  <h2 id="facilities-title">Tesisler</h2>
                  <FacilityTable rows={data.facilities} />
                </section>
              </div>
            ) : (
              <NoDataPanel />
            )}
            <ExportButtons adapter={adapter} filters={query} disabled={status === "loading"} />
          </div>
        )}
      </main>
    </div>
  );
}
