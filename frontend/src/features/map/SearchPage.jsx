import React, { useEffect, useState } from "react";
import MapView from "./MapView.jsx";
import { fetchNearbyToilets } from "./toiletApi.js";

const DEFAULT_CENTER = { lat: 41.0, lon: 29.0 };
const INITIAL_FILTERS = {
  open_now: true,
  has_disabled_access: false,
  has_baby_changing: false,
  pricing: "all", // "all" | "free" | "paid"
};

export default function SearchPage({ onSwitchToAdmin }) {
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

    fetchNearbyToilets({
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
  }, [searchCenter, radius, filters, retryToken]);

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

  const formatBooleanField = (val, trueText, falseText) => {
    if (val === null || val === undefined) return "Bilinmiyor";
    return val ? trueText : falseText;
  };

  const hasLocationPermission = locationStatus === "granted";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <strong style={{ fontSize: "18px", color: "#0f172a" }}>SmartLoo</strong>

          <label style={{ fontSize: "14px" }}>
            Yarıçap:{" "}
            <select
              aria-label="Arama yarıçapı"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
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
            <strong>Yarıçap:</strong> {radius} m · <strong>Merkez:</strong> {searchCenter.lat.toFixed(3)}, {searchCenter.lon.toFixed(3)} ·{" "}
            {loading ? "Yükleniyor..." : `${toilets.length} tesis`}
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

        {locationStatus === "pending" && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af", background: "#eff6ff", padding: "6px 10px", borderRadius: "4px" }}>
            Konum izni bekleniyor... Şimdilik varsayılan merkez (41.0, 29.0) gösteriliyor.
          </div>
        )}

        {locationStatus === "denied" && (
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
            Bu bölgede seçili kriterlere uygun tuvalet bulunamadı. Yarıçapı artırmayı, haritayı kaydırmayı veya filtreleri temizlemeyi deneyin.
          </div>
        )}
      </header>

      <div style={{ position: "relative", flex: 1 }}>
        <MapView
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

        {selectedToilet && (
          <aside
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "min(310px, calc(100vw - 32px))",
              background: "#ffffff",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              zIndex: 1000,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>{selectedToilet.name}</h3>
              <button
                type="button"
                aria-label="Detay panelini kapat"
                onClick={() => setSelectedToilet(null)}
                style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#64748b" }}
              >
                &times;
              </button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "12px", fontSize: "14px", lineHeight: "1.9", color: "#334155" }}>
              {hasLocationPermission && selectedToilet.distance_m != null && (
                <li><strong>Kullanıcı Mesafesi:</strong> {Math.round(selectedToilet.distance_m)} m</li>
              )}
              <li><strong>Durum:</strong> {formatBooleanField(selectedToilet.is_open_now, "Açık", "Kapalı")}</li>
              <li><strong>Engelli Erişimi:</strong> {formatBooleanField(selectedToilet.has_disabled_access, "Var", "Yok")}</li>
              <li><strong>Bebek Bakım:</strong> {formatBooleanField(selectedToilet.has_baby_changing, "Var", "Yok")}</li>
              <li><strong>Ücret:</strong> {formatBooleanField(selectedToilet.is_free, "Ücretsiz", "Ücretli")}</li>
              <li>
                <strong>Hijyen Puanı:</strong>{" "}
                {selectedToilet.average_cleanliness != null
                  ? `${selectedToilet.average_cleanliness} / 5`
                  : "Henüz puanlanmamış"}
              </li>
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
} 