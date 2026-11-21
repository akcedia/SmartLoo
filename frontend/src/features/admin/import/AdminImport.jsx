// Administration > İçe aktarım (FR-07 import, #58). Uploads one CSV or JSON file
// to POST /api/v1/admin/import through the shared session client. Flow:
// choose file → early checks → explicit confirmation → one request → counts or errors.
// Nothing is retried automatically, and a rejected file never reports partial success.

import { useEffect, useId, useRef, useState } from "react";
import {
  detectFormat,
  formatInfo,
  importErrorMessage,
  inspectImport,
  MAX_BYTES,
  MAX_RECORDS,
  rowErrors,
  uploadImport,
} from "./importApi.js";

const COUNT_LABELS = [
  ["inserted", "Eklenen", "Yeni kaynak kimlikleri"],
  ["updated", "Eşleşen", "Var olan kaynak kimlikleri (değişmeyenler dahil)"],
  ["unchanged", "Değişmeyen", "Eşleşenlerden verisi aynı kalanlar"],
  ["rejected", "Reddedilen", "Kabul edilmeyen kayıtlar"],
];

function formatBytes(bytes) {
  return bytes < 1024 ? `${bytes} bayt` : `${(bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
}

export default function AdminImport({ api, readFile = (file) => file.text() }) {
  const [selection, setSelection] = useState(null); // { file, format, records, problem }
  const [step, setStep] = useState("idle"); // idle | ready | uploading | done | failed
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const inputRef = useRef(null);
  const outcomeRef = useRef(null);
  const inputId = useId();
  const hintId = useId();

  // Announce the outcome by moving focus to it once it renders.
  useEffect(() => {
    if (step === "done" || step === "failed") outcomeRef.current?.focus();
  }, [step]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    setResult(null);
    setError(null);
    if (!file) {
      setSelection(null);
      setStep("idle");
      return;
    }
    const format = detectFormat(file);
    let text = "";
    if (format && file.size > 0 && file.size <= MAX_BYTES) {
      try {
        text = await readFile(file);
      } catch {
        setSelection({ file, format, records: null, problem: "Dosya okunamadı." });
        setStep("idle");
        return;
      }
    }
    const { records, problem } = inspectImport({ text, size: file.size, format });
    setSelection({ file, format, records, problem });
    setStep(problem ? "idle" : "ready");
  }

  async function confirmUpload() {
    if (inFlight.current || !selection || selection.problem) return;
    inFlight.current = true;
    setStep("uploading");
    setError(null);
    try {
      setResult(await uploadImport(api, { file: selection.file, format: selection.format }));
      setStep("done");
    } catch (err) {
      setError(err);
      setStep("failed");
    } finally {
      inFlight.current = false;
    }
  }

  function reset() {
    setSelection(null);
    setResult(null);
    setError(null);
    setStep("idle");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  const uploading = step === "uploading";
  const errors = rowErrors(error);

  return (
    <section className="admin-import" aria-labelledby="import-title">
      <h2 id="import-title">Tesis verisi içe aktar</h2>
      <p className="admin-import-intro">
        CSV veya JSON dosyasındaki tesisler <code>(source, source_id)</code> kimliğine göre eklenir ya da güncellenir.
        Dosyadaki tek bir hatalı kayıt tüm dosyayı geri alır. Boş bırakılan alanlar “bilinmiyor” olarak kalır; hiçbir tesis
        kendiliğinden erişilebilir, ücretsiz veya açık sayılmaz.
      </p>

      <div className="admin-import-field">
        <label htmlFor={inputId}>Dosya</label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          aria-describedby={hintId}
          onChange={handleFile}
          disabled={uploading}
        />
        <p id={hintId} className="admin-hint">
          En fazla {MAX_BYTES.toLocaleString("tr-TR")} bayt ve {MAX_RECORDS.toLocaleString("tr-TR")} kayıt. Zorunlu sütunlar:
          source, source_id, name, district, latitude, longitude. Ayrıntılar: içe aktarım sözleşmesi.
        </p>
      </div>

      {selection?.problem && (
        <p className="admin-field-error" role="alert">{selection.problem}</p>
      )}

      {selection && !selection.problem && step !== "done" && (
        <div className="admin-import-confirm" aria-busy={uploading}>
          <h3>Yüklemeyi onaylayın</h3>
          <dl className="admin-import-summary">
            <dt>Dosya</dt>
            <dd>{selection.file.name}</dd>
            <dt>Biçim</dt>
            <dd>{formatInfo(selection.format).label}</dd>
            <dt>Boyut</dt>
            <dd>{formatBytes(selection.file.size)}</dd>
            <dt>Kayıt</dt>
            <dd>{selection.records}</dd>
          </dl>
          <p className="admin-hint">Onaydan sonra dosya tek bir istekle gönderilir ve sonuç gelene kadar tekrar gönderilemez.</p>
          <div className="admin-import-actions">
            <button type="button" onClick={confirmUpload} disabled={uploading || step === "failed"}>
              {uploading ? "Yükleniyor…" : "Yüklemeyi onayla"}
            </button>
            <button type="button" className="admin-button-secondary" onClick={reset} disabled={uploading}>
              Vazgeç
            </button>
          </div>
          {uploading && <p className="admin-status" role="status"><span className="admin-spinner" aria-hidden="true" /> Dosya gönderiliyor…</p>}
        </div>
      )}

      {step === "done" && result && (
        <div ref={outcomeRef} tabIndex={-1} className="admin-status admin-import-result" role="status">
          <h3>İçe aktarım tamamlandı</h3>
          <dl className="admin-import-counts">
            {COUNT_LABELS.map(([key, label, note]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <strong>{result[key]}</strong> <span className="admin-hint">{note}</span>
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={reset}>Başka dosya yükle</button>
        </div>
      )}

      {step === "failed" && error && (
        <div ref={outcomeRef} tabIndex={-1} className="admin-status admin-status--error" role="alert">
          <h3>İçe aktarım yapılmadı</h3>
          <p>{importErrorMessage(error)}</p>
          {errors.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table admin-import-errors">
                <caption>
                  Satır hataları{errors.length >= 50 ? " (ilk 50; dosyada başka hatalar da olabilir)" : ""}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Kayıt</th>
                    <th scope="col">Alan</th>
                    <th scope="col">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={`${e.row}-${e.field ?? ""}-${i}`}>
                      <th scope="row">{e.row === 0 ? "Dosya / başlık" : e.row}</th>
                      <td>{e.field ?? "—"}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={reset}>Dosyayı düzelt ve yeniden seç</button>
        </div>
      )}
    </section>
  );
}
