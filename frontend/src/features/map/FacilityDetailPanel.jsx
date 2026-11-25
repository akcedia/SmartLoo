import React from "react";
import AiSummaryBox from "./AiSummaryBox.jsx";
import ReviewSection from "./ReviewSection.jsx";
import DirectionsButton from "./DirectionsButton.jsx";
import AdminFacilityStatus from "./AdminFacilityStatus.jsx";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";

function formatBooleanField(val, trueText, falseText) {
  if (val === null || val === undefined) return "Bilinmiyor";
  return val ? trueText : falseText;
}

function formatStatus(item) {
  if (item.status === "CLOSED") return "Kapalı";
  if (item.status === "MAINTENANCE") return "Bakımda";
  if (item.is_open_now === true) return "Şu an açık";
  if (item.is_open_now === false) return "Kapalı";
  return "Bilinmiyor";
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
  const { t } = useI18n();
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
        width: "min(360px, calc(100% - 32px))",
        maxHeight: "calc(100% - 32px)",
        boxSizing: "border-box",
        overflowY: "auto",
        background: "var(--sl-surface)",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "var(--sl-shadow-md)",
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
          gap: "8px",
        }}
      >
        <div className="sl-detail-title">
          <h3>{merged.name}</h3>
          {merged.district && <p className="sl-detail-sub">{merged.district}</p>}
        </div>
        <button
          type="button"
          className="sl-detail-close"
          aria-label={t("Detay panelini kapat")}
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "20px",
            cursor: "pointer",
            color: "var(--sl-text-muted)",
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
            color: "var(--sl-accent-text)",
            background: "var(--sl-accent-soft)",
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
            color: "var(--sl-danger)",
            background: "var(--sl-danger-soft)",
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
            color: "var(--sl-warn)",
            background: "var(--sl-warn-soft)",
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
                border: "1px solid var(--sl-warn)",
                background: "var(--sl-surface)",
                color: "var(--sl-warn)",
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
          <dl className="sl-facts">
            {hasLocationPermission && merged.distance_m != null && (
              <Fact label={t("Mesafe")} value={`${Math.round(merged.distance_m)} m`} />
            )}
            <Fact label={t("Durum")} value={t(formatStatus(merged))} />
            <Fact label={t("Ücret")} value={translatePrice(formatPricing(merged.is_free, merged.price_try), t)} />
            <Fact label={t("Engelli erişimi")} value={t(formatBooleanField(merged.has_disabled_access, "Var", "Yok"))} />
            <Fact label={t("Bebek bakım")} value={t(formatBooleanField(merged.has_baby_changing, "Var", "Yok"))} />
            <Fact
              wide
              label={t("Hijyen puanı")}
              value={merged.average_cleanliness != null
                ? `${Number(merged.average_cleanliness).toFixed(1)} / 5${
                    merged.review_count != null ? ` · ${t("{n} değerlendirme", { n: merged.review_count })}` : ""
                  }`
                : t("Henüz puanlanmamış")}
              unknown={merged.average_cleanliness == null}
            />
          </dl>

          <DirectionsButton latitude={merged.latitude} longitude={merged.longitude} name={merged.name} />

          <AdminFacilityStatus toiletId={merged.id} status={merged.status} onChanged={onReviewsMutated} />

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

// One fact as a small card; unknown values are dimmed but still say "Bilinmiyor".
function Fact({ label, value, wide = false, unknown }) {
  const isUnknown = unknown ?? (value === "Bilinmiyor" || value === "Unknown");
  return (
    <div className={`sl-fact${wide ? " sl-fact--wide" : ""}${isUnknown ? " is-unknown" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function translatePrice(text, t) {
  const paid = /^Ücretli \((.+) TL\)$/.exec(text);
  return paid ? t("Ücretli ({price} TL)", { price: paid[1] }) : t(text);
}
