import { useMapApi } from "./MapApiProvider.jsx";
import React, { useEffect, useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";
import { buildSignInUrl } from "./toiletApi.js";

export default function AiRecommendationsPanel({
  isOpen,
  searchCenter,
  radius = 1000,
  filters,
  hasLocationPermission,
  onSelectToilet,
  onClose,
}) {
  const { lang, t } = useI18n();
  const { fetchAiRecommendations, getCurrentSessionUser } = useMapApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [aiReasonsAvailable, setAiReasonsAvailable] = useState(false);

  const currentUser = getCurrentSessionUser();

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    setAiReasonsAvailable(false);
    setFallbackMessage("");

    fetchAiRecommendations({
      lat: searchCenter.lat,
      lon: searchCenter.lon,
      radius,
      filters,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems(res.items || []);
        setAiReasonsAvailable(res.aiReasonsAvailable === true);
        if (res.fallback || (res.items || []).length === 0) {
          setFallbackMessage(
            res.message ||
              "Tercihlerinize uygun tesis önerisi şu anda bulunamadı; haritadaki tüm tesisleri inceleyebilirsiniz."
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        setItems([]);
        if (err.status === 401) {
          setFallbackMessage("Oturum süreniz dolmuş. Tesis önerileri için tekrar giriş yapın.");
        } else {
          setFallbackMessage(
            "Tesis önerileri şu anda kullanılamıyor; normal harita aramasıyla devam edebilirsiniz."
          );
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, currentUser?.id, searchCenter.lat, searchCenter.lon, radius, filters, retryToken]);

  if (!isOpen) return null;

  return (
    <aside
      className="sl-ai-recommendations"
      aria-label={t(aiReasonsAvailable ? "Yapay zeka tesis önerileri" : "Yakındaki uygun tesisler")}
      style={{
        position: "absolute",
        bottom: "24px",
        left: "16px",
        width: "min(330px, calc(100vw - 32px))",
        maxHeight: "55vh",
        overflowY: "auto",
        background: "var(--sl-surface)",
        padding: "14px",
        borderRadius: "8px",
        boxShadow: "var(--sl-shadow-md)",
        border: "1px solid var(--sl-border-strong)",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--sl-border)",
          paddingBottom: "8px",
          marginBottom: "10px",
        }}
      >
        <strong style={{ fontSize: "14px", color: "var(--sl-text)" }}>
          {t(aiReasonsAvailable ? "AI Tesis Önerileri (En Fazla 3)" : "Yakındaki Uygun Tesisler (En Fazla 3)")}
        </strong>
        <button
          type="button"
          aria-label={t("Tesis önerileri panelini kapat")}
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "18px",
            cursor: "pointer",
            color: "var(--sl-text-muted)",
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {!currentUser ? (
        <div style={{ fontSize: "13px", color: "var(--sl-text-secondary)" }}>
          <p style={{ margin: "0 0 8px 0", lineHeight: "1.45" }}>
            {t("Konum ve filtre tercihlerinize göre tesis önerilerini görmek için giriş yapın.")}
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
              background: "var(--sl-accent-solid)",
              color: "var(--sl-on-accent)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {t("Giriş Yap")}
          </button>
        </div>
      ) : loading ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--sl-text-muted)" }}>
          {t("Tercihlerinize uygun tesisler analiz ediliyor...")}
        </p>
      ) : fallbackMessage && items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--sl-text-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span>{t(fallbackMessage)}</span>
          <button
            type="button"
            onClick={() => setRetryToken((c) => c + 1)}
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid var(--sl-border-strong)",
              background: "var(--sl-surface)",
              color: "var(--sl-text-secondary)",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            {t("Tekrar Dene")}
          </button>
        </div>
      ) : (
        <div>
        {fallbackMessage && <p role="status" style={{ fontSize: "12px", color: "#475569" }}>{t(fallbackMessage)}</p>}
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
                  border: "1px solid var(--sl-border)",
                  background: "var(--sl-surface-sunken)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--sl-text)" }}>
                    {idx + 1}. {item.name}
                  </strong>
                  {item.average_cleanliness != null && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--sl-accent-text)" }}>
                      {Number(item.average_cleanliness).toFixed(1)} / 5
                    </span>
                  )}
                </div>

                {hasLocationPermission && item.distance_m != null && (
                  <div style={{ fontSize: "11px", color: "var(--sl-text-muted)", marginTop: "2px" }}>
                    {t("Mesafe: {n} m", { n: Math.round(item.distance_m) })}
                  </div>
                )}

                {aiReasonsAvailable && (item.reason || item.explanation) && (
                  <p lang={lang === "en" ? "tr" : undefined} style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--sl-text-secondary)", lineHeight: "1.4" }}>
                    {item.reason || item.explanation}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
        </div>
      )}
    </aside>
  );
}
