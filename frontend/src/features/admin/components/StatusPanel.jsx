// Full-panel states that replace the dashboard content.

export function LoadingPanel() {
  return (
    <div className="admin-status" role="status" aria-live="polite">
      <span className="admin-spinner" aria-hidden="true" /> Veriler yükleniyor…
    </div>
  );
}

export function ErrorPanel({ error, onRetry }) {
  if (error.status === 401) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>Oturum gerekli</h2>
        <p>Oturumunuz yok ya da süresi doldu. Paneli görmek için yönetici hesabıyla giriş yapın.</p>
        <a href="#/sign-in">Giriş yap</a>
      </div>
    );
  }
  if (error.status === 403) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>Yetkiniz yok</h2>
        <p>Bu sayfa yalnızca yöneticiler içindir. Hiçbir analiz verisi gösterilmedi.</p>
        <a href="#/">Haritaya dön</a>
      </div>
    );
  }
  if (error.status === 422) {
    return (
      <div className="admin-status admin-status--warn" role="alert">
        <h2>Filtre geçersiz</h2>
        <p>Sunucu seçilen filtreleri kabul etmedi. Tarihleri kontrol edin.</p>
      </div>
    );
  }
  return (
    <div className="admin-status admin-status--error" role="alert">
      <h2>Veriler alınamadı</h2>
      <p>Bir hata oluştu. Filtreleriniz korundu.</p>
      <button type="button" onClick={onRetry}>Tekrar dene</button>
    </div>
  );
}

export function NoDataPanel() {
  return (
    <div className="admin-status" role="status">
      <h2>Veri yok</h2>
      <p>Seçilen ilçe ve tarih aralığında değerlendirme bulunmuyor. Ortalama gösterilmez (0 değildir); ilçeyi ya da dönemi değiştirin.</p>
    </div>
  );
}
