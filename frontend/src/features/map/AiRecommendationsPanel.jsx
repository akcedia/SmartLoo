import { useMapApi } from "./MapApiProvider.jsx";
import React, { useEffect, useState } from "react";
import { buildSignInUrl } from "./toiletApi.js";

export default function AiRecommendationsPanel({
  isOpen,
  searchCenter,
  filters,
  hasLocationPermission,
  onSelectToilet,
  onClose,
}) {
  const { fetchAiRecommendations, getCurrentSessionUser } = useMapApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  const currentUser = getCurrentSessionUser();

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const controller = new AbortController();
    setLoading(true);
    setFallbackMessage("");

    fetchAiRecommendations({
      lat: searchCenter.lat,
      lon: searchCenter.lon,
      filters,
      signal: controller.signal,
    })
      .then((res) => {
        setItems(res.items || []);
        if (res.fallback || (res.items || []).length === 0) {
          setFallbackMessage(
            res.message ||
              "Tercihlerinize uygun yapay zeka önerisi şu anda bulunamadı; haritadaki tüm tesisleri inceleyebilirsiniz."
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setItems([]);
        if (err.status === 401) {
          setFallbackMessage("Oturum süreniz dolmuş. AI önerileri için tekrar giriş yapın.");
        } else {
          setFallbackMessage(
            "Yapay zeka öneri servisi şu anda kullanılamıyor; normal harita aramasıyla devam edebilirsiniz."
          );
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, currentUser?.id, searchCenter.lat, searchCenter.lon, filters, retryToken]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Yapay zeka tesis önerileri"
      style={{
        position: "absolute",
        bottom: "24px",
        left: "16px",
        width: "min(330px, calc(100vw - 32px))",
        maxHeight: "55vh",
        overflowY: "auto",
        background: "#ffffff",
        padding: "14px",
        borderRadius: "8px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        border: "1px solid #cbd5e1",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "8px",
          marginBottom: "10px",
        }}
      >
        <strong style={{ fontSize: "14px", color: "#0f172a" }}>
          AI Tesis Önerileri (En Fazla 3)
        </strong>
        <button
          type="button"
          aria-label="AI önerileri panelini kapat"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "18px",
            cursor: "pointer",
            color: "#64748b",
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {!currentUser ? (
        <div style={{ fontSize: "13px", color: "#334155" }}>
          <p style={{ margin: "0 0 8px 0", lineHeight: "1.45" }}>
            Konum ve filtre tercihlerinize göre kişiselleştirilmiş AI önerileri görmek için giriş yapın.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign(buildSignInUrl());
              }
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Giriş Yap
          </button>
        </div>
      ) : loading ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
          Tercihlerinize uygun tesisler analiz ediliyor...
        </p>
      ) : fallbackMessage && items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#64748b", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span>{fallbackMessage}</span>
          <button
            type="button"
            onClick={() => setRetryToken((c) => c + 1)}
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid #94a3b8",
              background: "#ffffff",
              color: "#334155",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item, idx) => (
            <li key={item.id ?? idx}>
              <button
                type="button"
                onClick={() => onSelectToilet && onSelectToilet(item)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                    {idx + 1}. {item.name}
                  </strong>
                  {item.average_cleanliness != null && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#1d4ed8" }}>
                      {Number(item.average_cleanliness).toFixed(1)} / 5
                    </span>
                  )}
                </div>

                {hasLocationPermission && item.distance_m != null && (
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    Mesafe: {Math.round(item.distance_m)} m
                  </div>
                )}

                {(item.reason || item.explanation) && (
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#334155", lineHeight: "1.4" }}>
                    {item.reason || item.explanation}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
