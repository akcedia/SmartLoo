import React, { useEffect, useState } from "react";
import MapView from "./MapView.jsx";
import { fetchNearbyToilets } from "./toiletApi.js";

const DEFAULT_CENTER = { lat: 41.0, lon: 29.0 };
const INITIAL_FILTERS = {
  open_now: true,
  has_disabled_access: false,
  has_baby_changing: false,
  is_free: false,
};

export default function SearchPage({ onSwitchToAdmin }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [radius, setRadius] = useState(1000);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [toilets, setToilets] = useState([]);
  const [selectedToilet, setSelectedToilet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setHasLocationPermission(true);
      },
      () => {
        setHasLocationPermission(false);
      }
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetchNearbyToilets({
      lat: center.lat,
      lon: center.lon,
      radius,
      filters,
      signal: controller.signal,
    })
      .then((data) => {
        setToilets(data.results || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Sunucuya bağlanılamadı. Backend servisinin çalıştığından emin olun.");
        setToilets([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [center, radius, filters]);

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetFilters = () => {
    setFilters({
      open_now: false,
      has_disabled_access: false,
      has_baby_changing: false,
      is_free: false,
    });
  };

  const formatBooleanField = (val, trueText, falseText) => {
    if (val === null || val === undefined) return "Bilinmiyor";
    return val ? trueText : falseText;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <strong style={{ fontSize: "18px", color: "#0f172a" }}>SmartLoo</strong>

          <label style={{ fontSize: "14px" }}>
            Yarıçap:{" "}
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
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
            { key: "is_free", label: "Ücretsiz" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: filters[key] ? "#2563eb" : "#ffffff",
                color: filters[key] ? "#ffffff" : "#1e293b",
                cursor: "pointer",
                fontWeight: filters[key] ? "600" : "400",
              }}
            >
              {label}
            </button>
          ))}

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

          <span style={{ marginLeft: "auto", fontSize: "13px", color: "#475569" }}>
            {loading ? "Aranıyor..." : `${toilets.length} tesis bulundu`}
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

        {!hasLocationPermission && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#92400e", background: "#fef3c7", padding: "6px 10px", borderRadius: "4px" }}>
            Konum izni verilmediği için varsayılan merkez (41.0, 29.0) kullanılıyor. Kullanıcı mesafesi yalnızca konum izni verildiğinde gösterilir.
          </div>
        )}

        {error && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#991b1b", background: "#fee2e2", padding: "6px 10px", borderRadius: "4px" }}>
            {error}
          </div>
        )}

        {!loading && !error && toilets.length === 0 && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af", background: "#dbeafe", padding: "6px 10px", borderRadius: "4px" }}>
            Yakında kriterlere uygun tuvalet bulunamadı. Arama yarıçapını artırmayı veya filtreleri temizlemeyi deneyin.
          </div>
        )}
      </header>

      <div style={{ position: "relative", flex: 1 }}>
        <MapView
          center={center}
          radius={radius}
          toilets={toilets}
          hasLocationPermission={hasLocationPermission}
          onSelectToilet={(toilet) => setSelectedToilet(toilet)}
          onClearSelection={() => setSelectedToilet(null)}
        />

        {selectedToilet && (
          <aside
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "310px",
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
                <li><strong>Mesafe:</strong> {Math.round(selectedToilet.distance_m)} m</li>
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