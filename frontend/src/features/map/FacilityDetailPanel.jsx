import React from "react";
import AiSummaryBox from "./AiSummaryBox.jsx";
import ReviewSection from "./ReviewSection.jsx";

function formatBooleanField(val, trueText, falseText) {
  if (val === null || val === undefined) return "Bilinmiyor";
  return val ? trueText : falseText;
}

function formatPricing(isFree, priceTry) {
  if (isFree === null || isFree === undefined) return "Bilinmiyor";
  if (isFree) return "Ücretsiz";
  if (priceTry !== null && priceTry !== undefined) {
    return `Ücretli (${Number(priceTry).toFixed(2)} TL)`;
  }
  return "Ücretli";
}

export default function FacilityDetailPanel({
  selectedToilet,
  detail,
  loading,
  error,
  notFound,
  hasLocationPermission,
  summaryRefreshKey = 0,
  onRetry,
  onReviewsMutated,
  onClose,
}) {
  if (!selectedToilet) return null;

  const merged = detail
    ? {
        ...selectedToilet,
        ...detail,
        distance_m:
          detail.distance_m !== undefined && detail.distance_m !== null
            ? detail.distance_m
            : selectedToilet.distance_m,
      }
    : selectedToilet;

  return (
    <aside
      aria-label="Tesis detayları"
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        width: "min(360px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 110px)",
        overflowY: "auto",
        background: "#ffffff",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
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
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
          {merged.name}
        </h3>
        <button
          type="button"
          aria-label="Detay panelini kapat"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "20px",
            cursor: "pointer",
            color: "#64748b",
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {loading && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "13px",
            color: "#1e40af",
            background: "#eff6ff",
            padding: "6px 10px",
            borderRadius: "4px",
          }}
        >
          Tesis detayları yükleniyor...
        </div>
      )}

      {notFound && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "13px",
            color: "#991b1b",
            background: "#fee2e2",
            padding: "8px 10px",
            borderRadius: "4px",
          }}
        >
          Bu tesis bulunamadı veya artık mevcut değil (404).
        </div>
      )}

      {!notFound && error && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "13px",
            color: "#92400e",
            background: "#fef3c7",
            padding: "8px 10px",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                alignSelf: "flex-start",
                padding: "3px 10px",
                borderRadius: "4px",
                border: "1px solid #92400e",
                background: "#ffffff",
                color: "#92400e",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Yeniden Dene
            </button>
          )}
        </div>
      )}

      {!notFound && (
        <>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: "12px",
              marginBottom: 0,
              fontSize: "14px",
              lineHeight: "1.9",
              color: "#334155",
            }}
          >
            {merged.district && (
              <li>
                <strong>İlçe:</strong> {merged.district}
              </li>
            )}
            {hasLocationPermission && merged.distance_m != null && (
              <li>
                <strong>Kullanıcı Mesafesi:</strong> {Math.round(merged.distance_m)} m
              </li>
            )}
            <li>
              <strong>Durum:</strong>{" "}
              {formatBooleanField(merged.is_open_now, "Açık", "Kapalı")}
              {merged.status && merged.status !== "ACTIVE" ? ` (${merged.status})` : ""}
            </li>
            <li>
              <strong>Engelli Erişimi:</strong>{" "}
              {formatBooleanField(merged.has_disabled_access, "Var", "Yok")}
            </li>
            <li>
              <strong>Bebek Bakım:</strong>{" "}
              {formatBooleanField(merged.has_baby_changing, "Var", "Yok")}
            </li>
            <li>
              <strong>Ücret:</strong>{" "}
              {formatPricing(merged.is_free, merged.price_try)}
            </li>
            <li>
              <strong>Hijyen Puanı:</strong>{" "}
              {merged.average_cleanliness != null
                ? `${Number(merged.average_cleanliness).toFixed(1)} / 5${
                    merged.review_count != null
                      ? ` (${merged.review_count} değerlendirme)`
                      : ""
                  }`
                : "Henüz puanlanmamış"}
            </li>
          </ul>

          <AiSummaryBox
            toiletId={merged.id}
            refreshKey={summaryRefreshKey}
          />

          <ReviewSection
            toiletId={merged.id}
            onReviewsMutated={onReviewsMutated}
          />
        </>
      )}
    </aside>
  ); 
}