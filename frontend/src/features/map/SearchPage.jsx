import { useMapApi } from "./MapApiProvider.jsx";
import React, { useEffect, useId, useRef, useState } from "react";
import MapView from "./MapView.jsx";
import FacilityDetailPanel from "./FacilityDetailPanel.jsx";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";
import { pinState } from "./mapPins.js";
import RadiusPicker from "./RadiusPicker.jsx";
import { formatRadius, loadMobileFiltersOpen, loadStartRadius, loadStartView, saveMobileFiltersOpen } from "../../shared/settings/preferences.js";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import "./map.css";

const DEFAULT_CENTER = { lat: 41.0, lon: 29.0 };
const INITIAL_FILTERS = {
  open_now: false,
  has_disabled_access: false,
  has_baby_changing: false,
  pricing: "all", // "all" | "free" | "paid"
};

export default function SearchPage({ onSwitchToAdmin }) {
  const { fetchIbbToilets, fetchNearbyToilets, fetchToiletDetail } = useMapApi();
  const [citywide, setCitywide] = useState(() => loadStartView() === "city");
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("pending"); // "pending" | "granted" | "denied"
  const [pendingCenter, setPendingCenter] = useState(null);

  const [radius, setRadius] = useState(loadStartRadius);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [toilets, setToilets] = useState([]);
  const [filterCoverage, setFilterCoverage] = useState(null);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  const [toiletDetail, setToiletDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailNotFound, setDetailNotFound] = useState(false);
  const [detailRetryToken, setDetailRetryToken] = useState(0);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Layout state only (no effect on what is fetched).
  const { t } = useI18n();
  const [view, setView] = useState("map"); // "map" | "list"
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locateError, setLocateError] = useState("");
  // Phones: the filter row folds behind an arrow button (closed by default).
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [filterRowOpen, setFilterRowOpen] = useState(loadMobileFiltersOpen);
  const filterRowId = useId();
  const toggleFilterRow = () => {
    setFilterRowOpen((open) => {
      saveMobileFiltersOpen(!open);
      return !open;
    });
  };
  const filtersPanelId = useId();
  const filtersButtonRef = useRef(null);
  const filtersPanelRef = useRef(null);

  useEffect(() => {
    if (filtersOpen) filtersPanelRef.current?.querySelector("button:not(:disabled)")?.focus();
  }, [filtersOpen]);

  const closeFilters = () => {
    setFiltersOpen(false);
    filtersButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setSearchCenter(coords);
        setPendingCenter(null);
        setLocationStatus("granted");
      },
      () => {
        setUserLocation(null);
        setLocationStatus("denied");
      }
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    (citywide ? fetchIbbToilets : fetchNearbyToilets)({
      lat: searchCenter.lat,
      lon: searchCenter.lon,
      radius,
      filters,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextResults = data.results || [];
        setToilets(nextResults);
        if (citywide) setFilterCoverage(data.filter_coverage ?? null);

        setSelectedToilet((prev) => {
          if (!prev) return null;
          return nextResults.find((item) => item.id === prev.id) || null;
        });

        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        setError("Tesis verileri yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin.");
        setToilets([]);
        setSelectedToilet(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, [searchCenter, radius, filters, retryToken, citywide, fetchIbbToilets, fetchNearbyToilets]);

  const selectedToiletId = selectedToilet?.id ?? null;

  useEffect(() => {
    if (!selectedToiletId) {
      setToiletDetail(null);
      setDetailLoading(false);
      setDetailError("");
      setDetailNotFound(false);
      return;
    }

    const controller = new AbortController();
    setToiletDetail(null);
    setDetailLoading(true);
    setDetailError("");
    setDetailNotFound(false);

    fetchToiletDetail(selectedToiletId, { signal: controller.signal })
      .then((data) => {
        setToiletDetail(data);
        setDetailLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err.status === 404) {
          setDetailNotFound(true);
        } else {
          setDetailError("Güncel tesis detayları alınamadı; özet bilgiler gösteriliyor.");
        }
        setDetailLoading(false);
      });

    return () => controller.abort();
  }, [selectedToiletId, detailRetryToken]);

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setPricingFilter = (pricingValue) => {
    setFilters((prev) => ({ ...prev, pricing: pricingValue }));
  };

  const resetFilters = () => {
    setFilters({
      open_now: false,
      has_disabled_access: false,
      has_baby_changing: false,
      pricing: "all",
    });
  };

  const handleSearchThisArea = () => {
    if (!pendingCenter) return;
    setSearchCenter(pendingCenter);
    setPendingCenter(null);
  };

  const handleLocate = () => {
    setLocateError("");
    if (userLocation) {
      setCitywide(false);
      setSearchCenter(userLocation);
      setPendingCenter(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocateError(t("Bu tarayıcı konum paylaşımını desteklemiyor."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setSearchCenter(coords);
        setPendingCenter(null);
        setLocationStatus("granted");
        setCitywide(false);
      },
      () => {
        setLocationStatus("denied");
        setLocateError(t("Konum izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da haritayı kaydırıp “Bu bölgede ara”yı kullanabilirsiniz."));
      },
    );
  };

  const hasLocationPermission = locationStatus === "granted";
  const openHoursUnavailable = citywide
    ? filterCoverage?.open_now === 0
    : toilets.length > 0 && toilets.every(toilet => toilet.is_open_now == null);
  const filterUnavailable = key => key === "open_now"
    ? openHoursUnavailable
    : citywide && filterCoverage?.[key] === 0;

  const activeFilterCount =
    (filters.open_now ? 1 : 0) + (filters.has_disabled_access ? 1 : 0) + (filters.has_baby_changing ? 1 : 0) + (filters.pricing !== "all" ? 1 : 0);
  const activeExtraFilters =
    (filters.has_disabled_access ? 1 : 0) + (filters.has_baby_changing ? 1 : 0) + (filters.pricing !== "all" ? 1 : 0);
  const anyFilter = filters.open_now || filters.has_disabled_access || filters.has_baby_changing || filters.pricing !== "all";
  const pricingUnavailable = (value) => citywide && value !== "all" && filterCoverage?.is_free === 0;
  const countLabel = loading
    ? t("Yükleniyor…")
    : citywide
      ? t("İstanbul geneli · {n} İBB kaydı", { n: toilets.length })
      : t("{radius} çevresinde · {n} tesis", { radius: formatRadius(radius), n: toilets.length });

  const chip = (key, label, pressed, onClick, disabled) => (
    <button key={key} type="button" className="sl-chip" aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className={`sl-search${view === "list" ? " sl-search--list" : ""}${selectedToilet ? " sl-search--detail" : ""}${filtersOpen ? " sl-search--filters" : ""}`}>
      <div className="sl-map-area">
        <MapView
          citywide={citywide}
          searchCenter={searchCenter}
          userLocation={userLocation}
          radius={radius}
          toilets={toilets}
          hasLocationPermission={hasLocationPermission}
          pendingCenter={pendingCenter}
          selectedToilet={selectedToilet}
          onMapMoved={(coords) => setPendingCenter(coords)}
          onSearchThisArea={handleSearchThisArea}
          onSelectToilet={(toilet) => setSelectedToilet(toilet)}
          onClearSelection={() => setSelectedToilet(null)}
        />

        <div className="sl-top">
        <div className="sl-toolbar">
          {/* Group 1: where to search (mode + radius) and the view switch */}
          <div className="sl-group sl-group-mode" role="group" aria-label={t("Arama alanı")}>
            <div className="sl-segmented sl-view-switch" role="group" aria-label={t("Görünüm")}>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
                <MapIcon /><span className="sl-view-label">{t("Harita")}</span>
              </button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                <ListIcon /><span className="sl-view-label">{t("Liste")}</span>
              </button>
            </div>
            <div className="sl-segmented" role="group" aria-label={t("Arama modu")}>
              <button type="button" aria-pressed={citywide} onClick={() => { setCitywide(true); setPendingCenter(null); }}>
                <span className="sl-label-long">{t("İstanbul geneli")}</span>
                <span className="sl-label-short">{t("İstanbul")}</span>
              </button>
              <button type="button" aria-pressed={!citywide} onClick={() => setCitywide(false)}>{t("Yakınımda")}</button>
              <RadiusPicker radius={radius} onChange={(value) => { setRadius(value); setCitywide(false); }} />
            </div>
          </div>

          {/* Group 2: what to show (the two most used filters + all filters) */}
          <div className={`sl-group sl-group-filters${filterRowOpen ? " is-open" : ""}`} role="group" aria-label={t("Tesis filtreleri")}>
            <button
              type="button"
              className="sl-row-toggle"
              aria-expanded={filterRowOpen}
              aria-controls={filterRowId}
              aria-label={filterRowOpen ? t("Filtreleri gizle") : t("Filtreleri göster")}
              onClick={toggleFilterRow}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 6l6 6-6 6" />
              </svg>
              {!filterRowOpen && activeFilterCount > 0 && <span className="sl-badge" aria-hidden="true">{activeFilterCount}</span>}
            </button>
            <div id={filterRowId} className="sl-filter-chips" {...(isPhone && !filterRowOpen ? { inert: "" } : {})}>
            {chip(
              "open_now",
              `${OPEN_NOW_LABEL}${filterUnavailable("open_now") ? " (bilgi yok)" : ""}`,
              filters.open_now,
              () => toggleFilter("open_now"),
              (filterUnavailable("open_now") || loading) && !filters.open_now,
            )}
            <button
              ref={filtersButtonRef}
              type="button"
              className="sl-chip sl-chip--filters"
              aria-expanded={filtersOpen}
              aria-controls={filtersPanelId}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <FilterIcon /> {t("Filtreler")}
              {activeExtraFilters > 0 && <span className="sl-badge" aria-label={t("{n} filtre seçili", { n: activeExtraFilters })}>{activeExtraFilters}</span>}
            </button>
            </div>
          </div>
        </div>

        {/* All filters, grouped. Kept in the DOM while closed so state and tests stay simple. */}
        <div
          id={filtersPanelId}
          ref={filtersPanelRef}
          className="sl-filter-panel"
          role="dialog"
          aria-modal="false"
          aria-label={t("Filtreler")}
          hidden={!filtersOpen}
          onKeyDown={(e) => { if (e.key === "Escape") closeFilters(); }}
        >
          <div className="sl-filter-head">
            <strong>{t("Filtreler")}</strong>
            <button type="button" className="sl-icon-button" aria-label={t("Filtreleri kapat")} onClick={closeFilters}>×</button>
          </div>
          <fieldset className="sl-filter-group">
            <legend>{t("Erişilebilirlik ve olanaklar")}</legend>
            {[
              { key: "has_disabled_access", label: "Engelli Erişimi" },
              { key: "has_baby_changing", label: "Bebek Bakım" },
            ].map(({ key, label }) =>
              chip(key, `${label}${filterUnavailable(key) ? " (bilgi yok)" : ""}`, filters[key], () => toggleFilter(key), filterUnavailable(key) && !filters[key]),
            )}
          </fieldset>
          <fieldset className="sl-filter-group">
            <legend>{t("Ücret")}</legend>
            <div className="sl-segmented" role="group" aria-label="Ücret filtresi">
              {[
                { value: "all", label: "Tümü" },
                { value: "free", label: "Ücretsiz" },
                { value: "paid", label: "Ücretli" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={pricingUnavailable(value) && filters.pricing !== value}
                  aria-pressed={filters.pricing === value}
                  onClick={() => setPricingFilter(value)}
                >
                  {label}{pricingUnavailable(value) ? " (bilgi yok)" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          {citywide && filterCoverage && (
            <p role="status" className="sl-filter-note">
              Doğrulanmış bilgi bulunan kayıtlar: Engelli erişimi {filterCoverage.has_disabled_access}/{filterCoverage.total},
              {" "}bebek bakım {filterCoverage.has_baby_changing}/{filterCoverage.total}, ücret {filterCoverage.is_free}/{filterCoverage.total}.
              {filterCoverage.open_now != null && <> çalışma saati doğrulanmış aktif tesis {filterCoverage.open_now}/{filterCoverage.total}.</>}
              {" "}Bilgisi olmayan filtreler kullanılamaz; bilinmeyen özellikler var veya yok sayılmaz.
            </p>
          )}
          <div className="sl-filter-actions">
            <button type="button" className="sl-button-secondary" onClick={resetFilters} disabled={!anyFilter}>
              Filtreleri Temizle
            </button>
            <button type="button" className="sl-button-primary" onClick={closeFilters}>
              {t("Sonuçları göster ({n})", { n: toilets.length })}
            </button>
          </div>
        </div>

        <div className="sl-notices">
          {locateError && <p className="sl-notice sl-notice--warn" role="alert">{locateError}</p>}
          {/* One-line notices: a short visible text; the full sentence stays for screen readers. */}
          {!citywide && locationStatus === "pending" && (
            <Notice kind="info" short={t("Konum izni bekleniyor…")}
              full={t("Konum izni bekleniyor… Şimdilik varsayılan merkez gösteriliyor.")} />
          )}
          {!citywide && locationStatus === "denied" && (
            <Notice kind="warn" short={t("Konum izni yok")}
              full={t("Konum izni yok; haritanın merkezi kullanılıyor ve mesafe gösterilmez.")}>
              <button type="button" className="sl-link-button" onClick={() => { setCitywide(true); setPendingCenter(null); }}>
                {t("İstanbul geneline dön")}
              </button>
            </Notice>
          )}
          {!citywide && !loading && !error && openHoursUnavailable && (
            <Notice kind="info" role="status" short={t("Çalışma saati bilgisi yok")}
              full="Bu sonuçlarda çalışma saati bilgisi yok. Şu An Açık filtresi kullanılamıyor; tesisler gösterilmeye devam ediyor." />
          )}
          {error && (
            <Notice kind="error" role="alert" short={t("Tesisler yüklenemedi")} full={error}>
              <button type="button" className="sl-link-button" onClick={() => setRetryToken((c) => c + 1)}>Yeniden Dene</button>
            </Notice>
          )}
          {!loading && !error && toilets.length === 0 && (
            <Notice kind="info" short={citywide ? t("Uygun İBB kaydı yok") : t("Bu bölgede uygun tesis yok")}
              full={citywide
                ? "Seçili filtrelere uygun İBB kaydı bulunamadı. Filtreleri temizlemeyi deneyin."
                : "Bu bölgede seçili kriterlere uygun tuvalet bulunamadı. Yarıçapı artırmayı, haritayı kaydırmayı veya filtreleri temizlemeyi deneyin."}>
              {anyFilter && (
                <button type="button" className="sl-link-button" onClick={resetFilters}>{t("Filtreleri temizle")}</button>
              )}
            </Notice>
          )}
        </div>

        {view === "list" && (
          <ResultList
            toilets={toilets}
            citywide={citywide}
            showDistance={!citywide && hasLocationPermission}
            loading={loading}
            onSelect={(toilet) => { setSelectedToilet(toilet); setView("map"); }}
          />
        )}
        </div>

        <div className="sl-fabs">
          <button
            type="button"
            className="sl-fab sl-fab--ai"
            aria-label={t("AI Önerileri")}
            aria-expanded={showRecommendations}
            onClick={() => setShowRecommendations((prev) => !prev)}
          >
            <SparkIcon /> <span>{t("AI Önerileri")}</span>
          </button>
          <button type="button" className="sl-fab sl-fab--locate" onClick={handleLocate} aria-label={t("Konumum")} title={t("Konumum")}>
            <LocateIcon />
          </button>
          {onSwitchToAdmin && (
            <button type="button" className="sl-fab" onClick={onSwitchToAdmin}>Admin Paneli</button>
          )}
        </div>

        <p className="sl-count" aria-live="polite">{countLabel}</p>

        <p className="sl-source">
          {t("Kaynak:")} <a href="https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti" target="_blank" rel="noreferrer">İBB Açık Veri Portalı</a>
          {" · "}<a href="https://data.ibb.gov.tr/license" target="_blank" rel="noreferrer">İBB Açık Veri Lisansı</a>
          <span className="sl-source-note">{" · "}{t("Kaynakta olmayan saat, ücret ve olanaklar “bilinmiyor” gösterilir.")}</span>
        </p>

        <AiRecommendationsPanel
          isOpen={showRecommendations}
          searchCenter={searchCenter}
          radius={radius}
          filters={filters}
          hasLocationPermission={hasLocationPermission}
          onSelectToilet={(toilet) => setSelectedToilet(toilet)}
          onClose={() => setShowRecommendations(false)}
        />

        <FacilityDetailPanel
          selectedToilet={selectedToilet}
          detail={toiletDetail}
          loading={detailLoading}
          error={detailError}
          notFound={detailNotFound}
          hasLocationPermission={!citywide && hasLocationPermission}
          summaryRefreshKey={detailRetryToken}
          onRetry={() => setDetailRetryToken((c) => c + 1)}
          onReviewsMutated={() => setDetailRetryToken((c) => c + 1)}
          onClose={() => setSelectedToilet(null)}
        />
      </div>
    </div>
  );
}

const OPEN_NOW_LABEL = "Şu An Açık";

const NOTICE_ICONS = {
  info: <path d="M12 16v-5M12 8h.01" />,
  warn: <path d="M12 9v4M12 17h.01" />,
  error: <path d="M15 9l-6 6M9 9l6 6" />,
};

function Notice({ kind, role, short, full, children }) {
  return (
    <p className={`sl-notice sl-notice--${kind}`} role={role} title={typeof full === "string" ? full : undefined}>
      <svg className="sl-notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9.5" />
        {NOTICE_ICONS[kind]}
      </svg>
      <span className="sl-notice-text" aria-hidden="true">{short}</span>
      <span className="app-sr">{full}</span>
      {children && <span className="sl-notice-action">{children}</span>}
    </p>
  );
}

function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener?.("change", onChange);
    return () => list.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

// "Açık" alone would clash with the theme name "Açık" (Light) in the catalog.
const STATE_TEXT = { open: "Şu an açık", closed: "Kapalı", unknown: "Saat bilinmiyor" };

// Text alternative to the map: every result as a button, nearest first in nearby mode.
function ResultList({ toilets, citywide, showDistance, loading, onSelect }) {
  const { t } = useI18n();
  const rows = [...toilets].sort((a, b) =>
    !citywide && a.distance_m != null && b.distance_m != null
      ? a.distance_m - b.distance_m
      : `${a.district ?? ""}${a.name ?? ""}`.localeCompare(`${b.district ?? ""}${b.name ?? ""}`, "tr"),
  );
  return (
    <section className="sl-list" aria-label={t("Tesis listesi")}>
      <h2 className="sl-list-title">{t("Tesisler ({n})", { n: rows.length })}</h2>
      {loading && <p className="sl-list-empty">{t("Yükleniyor…")}</p>}
      {!loading && rows.length === 0 && <p className="sl-list-empty">{t("Bu seçimde tesis yok.")}</p>}
      <ul>
        {rows.map((toilet) => {
          const state = pinState(toilet);
          return (
            <li key={toilet.id}>
              <button type="button" className="sl-list-item" onClick={() => onSelect(toilet)}>
                <span className={`sl-list-dot sl-list-dot--${state}`} aria-hidden="true" />
                <span className="sl-list-main">
                  <span className="sl-list-name">{toilet.name ?? t("Adsız tesis")}</span>
                  <span className="sl-list-meta">
                    {[toilet.district, t(STATE_TEXT[state]), toilet.average_cleanliness != null ? `★ ${Number(toilet.average_cleanliness).toFixed(1)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {showDistance && toilet.distance_m != null && (
                  <span className="sl-list-distance">{Math.round(toilet.distance_m)} m</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };

function MapIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
