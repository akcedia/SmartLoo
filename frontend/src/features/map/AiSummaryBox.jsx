import { useMapApi } from "./MapApiProvider.jsx";
import React, { useEffect, useState } from "react";

const RECOMMENDATION_BADGES = {
  recommended: {
    label: "Önerilir",
    bg: "#dcfce7",
    color: "#166534",
    border: "#86efac",
  },
  acceptable: {
    label: "Kabul Edilebilir",
    bg: "#fef3c7",
    color: "#92400e",
    border: "#fcd34d",
  },
  avoid: {
    label: "Kaçınılmalı",
    bg: "#fee2e2",
    color: "#991b1b",
    border: "#fca5a5",
  },
};

function formatGeneratedAt(isoDate) {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiSummaryBox({ toiletId, refreshKey = 0 }) {
  const { fetchToiletAiSummary } = useMapApi();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!toiletId) return;

    const controller = new AbortController();
    setLoading(true);
    setErrorMessage("");

    fetchToiletAiSummary(toiletId, { signal: controller.signal })
      .then((data) => {
        setSummaryData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setSummaryData(null);
        setErrorMessage(
          "Yapay zeka özeti şu anda kullanılamıyor; aşağıdaki kullanıcı yorumlarını doğrudan inceleyebilirsiniz."
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [toiletId, refreshKey, retryToken]);

  const isFallback =
    !summaryData ||
    summaryData.fallback === true ||
    summaryData.available === false ||
    summaryData.status === "unavailable" ||
    !summaryData.summary;

  const badge = summaryData?.recommendation
    ? RECOMMENDATION_BADGES[String(summaryData.recommendation).toLowerCase()] || null
    : null;

  const pros = Array.isArray(summaryData?.pros) ? summaryData.pros.slice(0, 3) : [];
  const cons = Array.isArray(summaryData?.cons) ? summaryData.cons.slice(0, 3) : [];
  const generatedLabel = formatGeneratedAt(summaryData?.generated_at);

  return (
    <section
      aria-label="Yapay zeka yorum özeti"
      style={{
        marginTop: "14px",
        padding: "10px 12px",
        borderRadius: "6px",
        background: "#f8fafc",
        border: "1px solid #cbd5e1",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
        }}
      >
        <strong style={{ fontSize: "13px", color: "#0f172a" }}>
          Yapay Zeka Özeti
        </strong>
        {!loading && !errorMessage && !isFallback && badge && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: "600",
              padding: "2px 8px",
              borderRadius: "999px",
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
            }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {loading && (
        <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>
          Yapay zeka yorum özeti hazırlanıyor...
        </p>
      )}

      {!loading && errorMessage && (
        <div style={{ fontSize: "12px", color: "#64748b", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setRetryToken((c) => c + 1)}
            style={{
              alignSelf: "flex-start",
              padding: "3px 8px",
              borderRadius: "4px",
              border: "1px solid #94a3b8",
              background: "#ffffff",
              color: "#334155",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Özeti Yenile
          </button>
        </div>
      )}

      {!loading && !errorMessage && isFallback && (
        <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.45" }}>
          {summaryData?.message ||
            summaryData?.reason ||
            "Bu tesis için henüz yapay zeka özeti oluşturulmadı veya AI servisi şu anda devre dışı."}
        </p>
      )}

      {!loading && !errorMessage && !isFallback && (
        <div style={{ fontSize: "13px", color: "#1e293b" }}>
          <p style={{ margin: "0 0 8px 0", lineHeight: "1.45" }}>
            {summaryData.summary}
          </p>

          {pros.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#166534", marginBottom: "2px" }}>
                Öne Çıkan Artılar
              </div>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#166534", lineHeight: "1.45" }}>
                {pros.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {cons.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#991b1b", marginBottom: "2px" }}>
                Dikkat Edilmesi Gerekenler
              </div>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#991b1b", lineHeight: "1.45" }}>
                {cons.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
            AI-generated summary
            {summaryData.based_on_reviews != null ? ` · ${summaryData.based_on_reviews} yoruma dayalı` : ""}
            {generatedLabel ? ` · ${generatedLabel}` : ""}
          </div>
        </div>
      )}
    </section>
  );
}
