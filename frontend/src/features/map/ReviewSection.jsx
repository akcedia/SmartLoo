import React, { useEffect, useState } from "react";
import {
  buildSignInUrl,
  createToiletReview,
  deleteReview,
  fetchToiletReviews,
  getCurrentSessionUser,
  updateReview,
} from "./toiletApi.js";

const MAX_COMMENT_LENGTH = 1000;

function formatReviewAuthor(review) {
  if (review.author) return review.author;
  if (review.display_name) return review.display_name;
  if (review.user_id === null || review.user_id === undefined) return "Anonim";
  return "Kayıtlı Kullanıcı";
}

function formatReviewDate(isoDate) {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapReviewError(err) {
  if (!err) return "İşlem sırasında beklenmeyen bir hata oluştu.";
  if (err.status === 401) {
    return "Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.";
  }
  if (err.status === 403) {
    return "Bu yorum üzerinde işlem yapma yetkiniz yok (403).";
  }
  if (err.status === 409) {
    return "Bu tesis için zaten bir yorumunuz var. Mevcut yorumunuzu düzenleyebilirsiniz.";
  }
  if (err.status === 422) {
    const firstFieldError = err.fieldErrors ? Object.values(err.fieldErrors)[0] : "";
    return firstFieldError
      ? `Geçersiz giriş: ${firstFieldError}`
      : "Lütfen 1 ile 5 arasında bir puan ve en fazla 1000 karakterlik yorum girin.";
  }
  return "Yorum servisine şu anda ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.";
}

export default function ReviewSection({ toiletId, onReviewsMutated }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const currentUser = getCurrentSessionUser();

  useEffect(() => {
    if (!toiletId) return;

    const controller = new AbortController();
    setLoading(true);
    setLoadError("");

    fetchToiletReviews(toiletId, { signal: controller.signal })
      .then((items) => {
        setReviews(items);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError("Yorumlar yüklenemedi. Lütfen tekrar deneyin.");
        setReviews([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [toiletId, reloadToken]);

  useEffect(() => {
    setEditingReviewId(null);
    setScore(5);
    setComment("");
    setActionError("");
    setActionSuccess("");
  }, [toiletId]);

  const existingUserReview = currentUser
    ? reviews.find(
        (rev) => rev.user_id !== null && rev.user_id !== undefined && String(rev.user_id) === currentUser.id
      ) || null
    : null;

  const isEditing = Boolean(editingReviewId);

  const handleStartEdit = (review) => {
    setEditingReviewId(review.id);
    setScore(Number(review.cleanliness_score) || 5);
    setComment(review.comment || "");
    setActionError("");
    setActionSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setScore(5);
    setComment("");
    setActionError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    if (!currentUser) {
      setActionError("Yorum göndermek için giriş yapmalısınız.");
      return;
    }

    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
      setActionError("Hijyen puanı 1 ile 5 arasında tam sayı olmalıdır.");
      return;
    }

    if (comment.trim().length > MAX_COMMENT_LENGTH) {
      setActionError(`Yorum en fazla ${MAX_COMMENT_LENGTH} karakter olabilir.`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingReviewId) {
        await updateReview(editingReviewId, {
          cleanliness_score: numericScore,
          comment,
        });
        setActionSuccess("Değerlendirmeniz güncellendi.");
        setEditingReviewId(null);
      } else {
        await createToiletReview(toiletId, {
          cleanliness_score: numericScore,
          comment,
        });
        setActionSuccess("Teşekkürler! Değerlendirmeniz kaydedildi.");
      }

      setScore(5);
      setComment("");
      setReloadToken((c) => c + 1);
      if (onReviewsMutated) onReviewsMutated();
    } catch (err) {
      setActionError(mapReviewError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    setActionError("");
    setActionSuccess("");
    setSubmitting(true);

    try {
      await deleteReview(reviewId);
      if (editingReviewId === reviewId) {
        setEditingReviewId(null);
        setScore(5);
        setComment("");
      }
      setActionSuccess("Yorum silindi.");
      setReloadToken((c) => c + 1);
      if (onReviewsMutated) onReviewsMutated();
    } catch (err) {
      setActionError(mapReviewError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedirectSignIn = () => {
    if (typeof window !== "undefined") {
      window.location.assign(buildSignInUrl());
    }
  };

  return (
    <section
      aria-label="Kullanıcı değerlendirmeleri"
      style={{
        marginTop: "14px",
        paddingTop: "12px",
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>
          Değerlendirmeler ({reviews.length})
        </h4>
      </div>

      {!currentUser ? (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "13px",
            color: "#334155",
            marginBottom: "12px",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            Hijyen puanı vermek veya yorum yazmak için giriş yapmalısınız.
          </p>
          <button
            type="button"
            onClick={handleRedirectSignIn}
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
      ) : existingUserReview && !isEditing ? (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "13px",
            color: "#1e3a8a",
            marginBottom: "12px",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            Bu tesis için daha önce değerlendirme yaptınız ({existingUserReview.cleanliness_score} / 5).
          </p>
          <button
            type="button"
            onClick={() => handleStartEdit(existingUserReview)}
            style={{
              padding: "5px 10px",
              borderRadius: "5px",
              border: "1px solid #1d4ed8",
              background: "#ffffff",
              color: "#1d4ed8",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Yorumumu Düzenle
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "10px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>
            {isEditing ? "Değerlendirmenizi Düzenleyin" : "Yeni Değerlendirme Yaz"}
          </div>

          <label style={{ display: "block", fontSize: "12px", color: "#334155", marginBottom: "8px" }}>
            Hijyen Puanı (1–5):{" "}
            <select
              aria-label="Hijyen puanı"
              value={score}
              disabled={submitting}
              onChange={(e) => setScore(Number(e.target.value))}
              style={{
                marginLeft: "4px",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
              }}
            >
              <option value={5}>5 - Çok Temiz</option>
              <option value={4}>4 - Temiz</option>
              <option value={3}>3 - Orta</option>
              <option value={2}>2 - Yetersiz</option>
              <option value={1}>1 - Çok Kirli</option>
            </select>
          </label>

          <label style={{ display: "block", fontSize: "12px", color: "#334155" }}>
            Yorum (İsteğe bağlı):
            <textarea
              aria-label="Yorum metni"
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={submitting}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Temizlik, sabun/kağıt durumu veya erişilebilirlik hakkında kısa not..."
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                marginTop: "4px",
                padding: "6px 8px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "6px",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {comment.length} / {MAX_COMMENT_LENGTH}
            </span>

            <div style={{ display: "flex", gap: "6px" }}>
              {isEditing && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCancelEdit}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "5px",
                    border: "1px solid #94a3b8",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  İptal
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "5px 12px",
                  borderRadius: "5px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Kaydediliyor..." : isEditing ? "Güncelle" : "Gönder"}
              </button>
            </div>
          </div>
        </form>
      )}

      {actionError && (
        <div
          role="alert"
          style={{
            marginBottom: "10px",
            fontSize: "12px",
            color: "#991b1b",
            background: "#fee2e2",
            padding: "7px 10px",
            borderRadius: "4px",
          }}
        >
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div
          style={{
            marginBottom: "10px",
            fontSize: "12px",
            color: "#166534",
            background: "#dcfce7",
            padding: "7px 10px",
            borderRadius: "4px",
          }}
        >
          {actionSuccess}
        </div>
      )}

      {loading && (
        <div style={{ fontSize: "13px", color: "#475569" }}>
          Yorumlar yükleniyor...
        </div>
      )}

      {!loading && loadError && (
        <div
          style={{
            fontSize: "12px",
            color: "#92400e",
            background: "#fef3c7",
            padding: "8px 10px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setReloadToken((c) => c + 1)}
            style={{
              padding: "3px 8px",
              borderRadius: "4px",
              border: "1px solid #92400e",
              background: "#ffffff",
              color: "#92400e",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {!loading && !loadError && reviews.length === 0 && (
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Bu tesis için henüz yorum yapılmamış.
        </p>
      )}

      {!loading && !loadError && reviews.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {reviews.map((rev) => {
            const isOwner =
              Boolean(currentUser) &&
              rev.user_id !== null &&
              rev.user_id !== undefined &&
              String(rev.user_id) === currentUser.id;
            const canDelete = isOwner || currentUser?.role === "ADMIN";
            const dateLabel = formatReviewDate(rev.updated_at || rev.created_at);

            return (
              <li
                key={rev.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  background: isOwner ? "#f8fafc" : "#ffffff",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                  <strong style={{ color: "#0f172a", fontSize: "12px" }}>
                    {formatReviewAuthor(rev)}
                  </strong>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#1d4ed8" }}>
                    {rev.cleanliness_score} / 5
                  </span>
                </div>

                {dateLabel && (
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    {dateLabel}
                  </div>
                )}

                {rev.comment && (
                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#334155",
                      lineHeight: "1.45",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {rev.comment}
                  </p>
                )}

                {(isOwner || canDelete) && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    {isOwner && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleStartEdit(rev)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#1e293b",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Düzenle
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleDelete(rev.id)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#991b1b",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
} 