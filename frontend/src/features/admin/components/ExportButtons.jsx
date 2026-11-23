import { useState } from "react";
import { EXPORT_COLUMNS, EXPORT_FORMATS } from "../api/contract.js";
import { useI18n } from "../../../shared/i18n/I18nProvider.jsx";
import { translate } from "../../../shared/i18n/i18n.js";

function download({ filename, mimeType, body }) {
  const blob = body instanceof Blob ? body : new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORT_ERRORS = {
  401: "{format} indirilemedi: oturumunuzun süresi doldu. Yeniden giriş yapın.",
  403: "{format} indirilemedi: bu işlem için yönetici yetkisi gerekir.",
  422: "{format} indirilemedi: seçilen filtreler geçersiz.",
  501: "{format} dışa aktarımı henüz backend'de uygulanmadı.",
  0: "{format} indirilemedi: sunucuya ulaşılamadı.",
};

export function exportErrorMessage(format, error, lang = "tr") {
  const template = EXPORT_ERRORS[error?.status] ?? "{format} indirilemedi: sunucu hatası. Hiçbir dosya oluşturulmadı; tekrar deneyin.";
  return translate(lang, template, { format: format.toUpperCase() });
}

// Export always sends the filters currently on screen (same selection as the KPIs).
// A failed request never produces a file.
export default function ExportButtons({ adapter, filters, disabled }) {
  const [status, setStatus] = useState({ busy: null, error: null, done: null });
  const { t, lang } = useI18n();

  async function handleExport(format) {
    setStatus({ busy: format, error: null, done: null });
    try {
      const file = await adapter.fetchExport(filters, format);
      download(file);
      setStatus({ busy: null, error: null, done: { filename: file.filename } });
    } catch (error) {
      setStatus({ busy: null, error: { format, error }, done: null });
    }
  }

  return (
    <section className="admin-export" aria-label={t("Dışa aktarım")}>
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          disabled={disabled || status.busy !== null}
          onClick={() => handleExport(format)}
        >
          {status.busy === format ? t("Hazırlanıyor…") : t("{format} dışa aktar", { format: format.toUpperCase() })}
        </button>
      ))}
      <p className="admin-hint">{t("Sütunlar: {columns}. Olmayan operasyonel değerler CSV'de boş, JSON'da null.", { columns: EXPORT_COLUMNS.join(", ") })}</p>
      {/* Polite live region: announces a finished download without moving focus. */}
      <p className="admin-hint" role="status">{status.done && t("{filename} indirildi.", status.done)}</p>
      {status.error && <p className="admin-field-error" role="alert">{exportErrorMessage(status.error.format, status.error.error, lang)}</p>}
    </section>
  );
}
