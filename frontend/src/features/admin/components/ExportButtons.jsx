import { useState } from "react";
import { EXPORT_COLUMNS, EXPORT_FORMATS } from "../api/contract.js";

function download({ filename, mimeType, body }) {
  const blob = body instanceof Blob ? body : new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportErrorMessage(format, error) {
  const label = format.toUpperCase();
  switch (error?.status) {
    case 401:
      return `${label} indirilemedi: oturumunuzun süresi doldu. Yeniden giriş yapın.`;
    case 403:
      return `${label} indirilemedi: bu işlem için yönetici yetkisi gerekir.`;
    case 422:
      return `${label} indirilemedi: seçilen filtreler geçersiz.`;
    case 501:
      return `${label} dışa aktarımı henüz backend'de uygulanmadı.`;
    case 0:
      return `${label} indirilemedi: sunucuya ulaşılamadı.`;
    default:
      return `${label} indirilemedi: sunucu hatası. Hiçbir dosya oluşturulmadı; tekrar deneyin.`;
  }
}

// Export always sends the filters currently on screen (same selection as the KPIs).
// A failed request never produces a file.
export default function ExportButtons({ adapter, filters, disabled }) {
  const [status, setStatus] = useState({ busy: null, error: null, done: null });

  async function handleExport(format) {
    setStatus({ busy: format, error: null, done: null });
    try {
      const file = await adapter.fetchExport(filters, format);
      download(file);
      setStatus({ busy: null, error: null, done: `${file.filename} indirildi.` });
    } catch (error) {
      setStatus({ busy: null, error: exportErrorMessage(format, error), done: null });
    }
  }

  return (
    <section className="admin-export" aria-label="Dışa aktarım">
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          disabled={disabled || status.busy !== null}
          onClick={() => handleExport(format)}
        >
          {status.busy === format ? "Hazırlanıyor…" : `${format.toUpperCase()} dışa aktar`}
        </button>
      ))}
      <p className="admin-hint">Sütunlar: {EXPORT_COLUMNS.join(", ")}. Olmayan operasyonel değerler CSV'de boş, JSON'da null.</p>
      {/* Polite live region: announces a finished download without moving focus. */}
      <p className="admin-hint" role="status">{status.done}</p>
      {status.error && <p className="admin-field-error" role="alert">{status.error}</p>}
    </section>
  );
}
