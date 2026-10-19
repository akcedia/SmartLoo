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

// Export always sends the filters currently on screen (same selection as the KPIs).
export default function ExportButtons({ adapter, filters, disabled }) {
  const [status, setStatus] = useState({ busy: null, error: null });

  async function handleExport(format) {
    setStatus({ busy: format, error: null });
    try {
      download(await adapter.fetchExport(filters, format));
      setStatus({ busy: null, error: null });
    } catch (error) {
      setStatus({ busy: null, error: `${format.toUpperCase()} dışa aktarılamadı: ${error.message}` });
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
      {status.error && <p className="admin-field-error" role="alert">{status.error}</p>}
    </section>
  );
}
