// Full-panel states that replace the dashboard content.

import { Link, signInPath } from "../../../app/router.jsx";
import { useI18n } from "../../../shared/i18n/I18nProvider.jsx";

export function LoadingPanel() {
  const { t } = useI18n();
  return (
    <div className="admin-status" role="status" aria-live="polite">
      <span className="admin-spinner" aria-hidden="true" /> {t("Veriler yükleniyor…")}
    </div>
  );
}

// First load: placeholder shapes instead of empty space.
export function SkeletonPanel() {
  const { t } = useI18n();
  return (
    <div className="admin-skeleton" role="status" aria-label={t("Veriler yükleniyor")}>
      <div className="admin-skeleton-row">
        <span /><span /><span />
      </div>
      <span className="admin-skeleton-block" />
    </div>
  );
}

export function ErrorPanel({ error, onRetry }) {
  const { t } = useI18n();
  if (error.status === 401) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>{t("Oturum gerekli")}</h2>
        <p>{t("Oturumunuz yok ya da süresi doldu. Paneli görmek için yönetici hesabıyla giriş yapın.")}</p>
        <Link to={signInPath("/admin")}>{t("Giriş yap")}</Link>
      </div>
    );
  }
  if (error.status === 403) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>{t("Yetkiniz yok")}</h2>
        <p>{t("Bu sayfa yalnızca yöneticiler içindir. Hiçbir analiz verisi gösterilmedi.")}</p>
        <Link to="/">{t("Haritaya dön")}</Link>
      </div>
    );
  }
  if (error.status === 422) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>{t("Filtre geçersiz")}</h2>
        <p>{t("Sunucu seçilen filtreleri kabul etmedi. Tarihleri kontrol edin.")}</p>
      </div>
    );
  }
  if (error.status === 501) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>{t("Analitik servisi henüz hazır değil")}</h2>
        <p>{t("Backend bu uç noktayı henüz uygulamadı (501). Gösterilecek gerçek veri yok; örnek veri kullanılmadı.")}</p>
      </div>
    );
  }
  return (
    <div className="admin-status admin-status--error" role="alert">
      <h2>{t("Veriler alınamadı")}</h2>
      <p>{error.status === 0 ? t("Sunucuya ulaşılamadı.") : t("Sunucu hatası oluştu.")} {t("Filtreleriniz korundu.")}</p>
      <button type="button" onClick={onRetry}>{t("Tekrar dene")}</button>
    </div>
  );
}

// A successful empty result. Distinct from ErrorPanel: a failed query never lands here.
export function NoDataPanel({ hasFacilities = true }) {
  const { t } = useI18n();
  return (
    <div className="admin-status" role="status">
      <h2>{t("Veri yok")}</h2>
      <p>
        {hasFacilities
          ? t("Seçilen tarih aralığında bu tesisler için değerlendirme bulunmuyor.")
          : t("Seçilen ilçede eşleşen tesis yok.")}{" "}
        {t("Ortalama gösterilmez (0 değildir); ilçeyi ya da dönemi değiştirin.")}
      </p>
    </div>
  );
}
