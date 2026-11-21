import { useMapApi } from "./MapApiProvider.jsx";
import React, { useEffect, useState } from "react";
import MapView from "./MapView.jsx";
import FacilityDetailPanel from "./FacilityDetailPanel.jsx";
import AiRecommendationsPanel from "./AiRecommendationsPanel.jsx";

const DEFAULT_CENTER = { lat: 41.0, lon: 29.0 };
const INITIAL_FILTERS = {
  open_now: false,
  has_disabled_access: false,
  has_baby_changing: false,
  pricing: "all", // "all" | "free" | "paid"
};

export default function SearchPage({ onSwitchToAdmin }) {
  const { fetchIbbToilets, fetchNearbyToilets, fetchToiletDetail } = useMapApi();
  const [citywide, setCitywide] = useState(true);
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("pending"); // "pending" | "granted" | "denied"
  const [pendingCenter, setPendingCenter] = useState(null);

  const [radius, setRadius] = useState(1000);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [toilets, setToilets] = useState([]);
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
        const nextResults = data.results || [];
        setToilets(nextResults);

        setSelectedToilet((prev) => {
          if (!prev) return null;
          return nextResults.find((item) => item.id === prev.id) || null;
        });

        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
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

  const handleUseMyLocation = () => {
    if (!userLocation) return;
    setSearchCenter(userLocation);
    setPendingCenter(null);
  };

  const hasLocationPermission = locationStatus === "granted";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <strong style={{ fontSize: "18px", color: "#0f172a" }}>SmartLoo</strong>
          <button type="button" aria-pressed={citywide} onClick={() => { setCitywide(true); setPendingCenter(null); }}>
            İstanbul’daki İBB tesisleri
          </button>
          <button type="button" aria-pressed={!citywide} onClick={() => setCitywide(false)}>Yakınımda ara</button>

          <label style={{ fontSize: "14px" }}>
            Yarıçap:{" "}
            <select
              aria-label="Arama yarıçapı"
              value={radius}
              onChange={(e) => { setRadius(Number(e.target.value)); setCitywide(false); }}
              style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value={250}>250 m</option>
              <option value={500}>500 m</option>
              <option value={1000}>1000 m</option>
              <option value={2500}>2500 m</option>
              <option value={5000}>5000 m</option>
              <option value={10000}>10 km</option>
            </select>
          </label>

          {[
            { key: "open_now", label: "Şu An Açık" },
            { key: "has_disabled_access", label: "Engelli Erişimi" },
            { key: "has_baby_changing", label: "Bebek Bakım" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              style={{
                padding: "6px 11px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: filters[key] ? "#2563eb" : "#ffffff",
                color: filters[key] ? "#ffffff" : "#1e293b",
                cursor: "pointer",
                fontWeight: filters[key] ? "600" : "400",
                fontSize: "13px",
              }}
            >
              {label}
            </button>
          ))}

          <div role="group" aria-label="Ücret filtresi" style={{ display: "inline-flex", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
            {[
              { value: "all", label: "Tümü" },
              { value: "free", label: "Ücretsiz" },
              { value: "paid", label: "Ücretli" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPricingFilter(value)}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  borderRight: value !== "paid" ? "1px solid #cbd5e1" : "none",
                  background: filters.pricing === value ? "#2563eb" : "#ffffff",
                  color: filters.pricing === value ? "#ffffff" : "#1e293b",
                  cursor: "pointer",
                  fontWeight: filters.pricing === value ? "600" : "400",
                  fontSize: "13px",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #94a3b8",
              background: "#e2e8f0",
              color: "#334155",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Filtreleri Temizle
          </button>

          <button
            type="button"
            aria-expanded={showRecommendations}
            onClick={() => setShowRecommendations((prev) => !prev)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #7c3aed",
              background: showRecommendations ? "#7c3aed" : "#f5f3ff",
              color: showRecommendations ? "#ffffff" : "#5b21b6",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px",
            }}
          >
            Tesis Önerileri
          </button>

          {hasLocationPermission && userLocation && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #0284c7",
                background: "#e0f2fe",
                color: "#0369a1",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Konumuma Dön
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: "13px", color: "#475569" }}>
            {citywide ? "İstanbul geneli · " : `Yarıçap: ${radius} m · Merkez: ${searchCenter.lat.toFixed(3)}, ${searchCenter.lon.toFixed(3)} · `}
            {loading ? "Yükleniyor..." : `${toilets.length} ${citywide ? "İBB kaydı" : "tesis"}`}
          </span>

          {onSwitchToAdmin && (
            <button
              type="button"
              onClick={onSwitchToAdmin}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Admin Paneli
            </button>
          )}
        </div>

        <p style={{margin:"8px 0 0", fontSize:"12px"}}>
          Kaynak: <a href="https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti" target="_blank" rel="noreferrer">İBB Açık Veri Portalı</a>
          {" · "}<a href="https://data.ibb.gov.tr/license" target="_blank" rel="noreferrer">İBB Açık Veri Lisansı</a>
          {" · Açılış saati, ücret ve olanaklar kaynakta yoksa bilinmiyor gösterilir."}
        </p>
        {!citywide && locationStatus === "pending" && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af", background: "#eff6ff", padding: "6px 10px", borderRadius: "4px" }}>
            Konum izni bekleniyor... Şimdilik varsayılan merkez (41.0, 29.0) gösteriliyor.
          </div>
        )}

        {!citywide && locationStatus === "denied" && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#92400e", background: "#fef3c7", padding: "6px 10px", borderRadius: "4px" }}>
            Konum izni reddedildi. Varsayılan veya seçilen harita merkezi kullanılıyor; kullanıcı mesafesi gösterilmez.
          </div>
        )}

        {error && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#991b1b", background: "#fee2e2", padding: "6px 10px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRetryToken((c) => c + 1)}
              style={{ padding: "3px 10px", borderRadius: "4px", border: "1px solid #991b1b", background: "#ffffff", color: "#991b1b", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
            >
              Yeniden Dene
            </button>
          </div>
        )}

        {!loading && !error && toilets.length === 0 && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af", background: "#dbeafe", padding: "6px 10px", borderRadius: "4px" }}>
            {citywide ? "Seçili filtrelere uygun İBB kaydı bulunamadı. Filtreleri temizlemeyi deneyin." : "Bu bölgede seçili kriterlere uygun tuvalet bulunamadı. Yarıçapı artırmayı, haritayı kaydırmayı veya filtreleri temizlemeyi deneyin."}
          </div>
        )}
      </header>

      <div style={{ position: "relative", flex: 1 }}>
        <MapView
          citywide={citywide}
          searchCenter={searchCenter}
          userLocation={userLocation}
          radius={radius}
          toilets={toilets}
          hasLocationPermission={hasLocationPermission}
          pendingCenter={pendingCenter}
          onMapMoved={(coords) => setPendingCenter(coords)}
          onSearchThisArea={handleSearchThisArea}
          onSelectToilet={(toilet) => setSelectedToilet(toilet)}
          onClearSelection={() => setSelectedToilet(null)}
        />

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
