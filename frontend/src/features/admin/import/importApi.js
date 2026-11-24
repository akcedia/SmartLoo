// ADMIN facility import client (FR-07 / REQ-DB-06), following
// docs/contracts/admin-import-api.md. The server validates every row and applies
// the whole batch atomically; the checks here only give early feedback.

export const IMPORT_PATH = "/api/v1/admin/import";
export const MAX_BYTES = 1_000_000;
export const MAX_RECORDS = 1000;
export const COUNT_KEYS = ["inserted", "updated", "unchanged", "rejected"];

const FORMATS = {
  csv: { label: "CSV", contentType: "text/csv" },
  json: { label: "JSON", contentType: "application/json" },
};

export function detectFormat(file) {
  const name = (file?.name ?? "").toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json")) return "json";
  const type = (file?.type ?? "").toLowerCase();
  if (type === "text/csv") return "csv";
  if (type === "application/json") return "json";
  return null;
}

export function formatInfo(format) {
  return FORMATS[format];
}

// Counts CSV records the way a strict RFC 4180 reader does: newlines inside
// quoted fields do not start a record and the header row is not a record.
export function countCsvRecords(text) {
  let rows = 0;
  let inQuotes = false;
  let rowHasContent = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      rowHasContent = true;
    } else if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      if (rowHasContent) rows += 1;
      rowHasContent = false;
    } else if (c !== "﻿") {
      rowHasContent = true;
    }
  }
  if (rowHasContent) rows += 1;
  return Math.max(0, rows - 1);
}

// Early checks before asking for confirmation. Returns { records, problem }.
export function inspectImport({ text, size, format }) {
  if (!format) return { records: null, problem: "Yalnızca .csv veya .json dosyası yüklenebilir." };
  if (size === 0) return { records: 0, problem: "Dosya boş." };
  if (size > MAX_BYTES) return { records: null, problem: "Dosya 1.000.000 bayttan büyük olamaz." };
  let records;
  if (format === "json") {
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^﻿/, ""));
    } catch {
      return { records: null, problem: "JSON dosyası okunamadı. Dosya geçerli bir JSON dizisi olmalı." };
    }
    if (!Array.isArray(parsed)) return { records: null, problem: "JSON dosyası tesis kayıtlarından oluşan bir dizi ([...]) olmalı." };
    records = parsed.length;
  } else {
    records = countCsvRecords(text);
  }
  if (records < 1) return { records, problem: "Dosyada yüklenecek kayıt yok." };
  if (records > MAX_RECORDS) {
    // `problem` stays the filled Turkish text; the screen translates `template` with `vars`.
    const template = "Bir dosyada en fazla {max} kayıt olabilir (bu dosyada {n}).";
    const vars = { max: MAX_RECORDS, n: records };
    return { records, problem: template.replace("{max}", vars.max).replace("{n}", vars.n), template, vars };
  }
  return { records, problem: null };
}

function validCounts(result) {
  return result && COUNT_KEYS.every((key) => Number.isInteger(result[key]) && result[key] >= 0);
}

// Sends the file bytes unchanged (CSV is never JSON-stringified). The bytes are read
// first so every fetch implementation sends them as-is, not as "[object File]".
export async function uploadImport(api, { file, format, signal }) {
  const bytes = await file.arrayBuffer();
  const result = await api.request(IMPORT_PATH, {
    method: "POST",
    rawBody: bytes,
    contentType: formatInfo(format).contentType,
    signal,
  });
  if (!validCounts(result)) {
    const error = new Error("Unexpected import response");
    error.status = 502;
    throw error;
  }
  return result;
}

// 422 bodies carry a top-level `errors` array; row 0 means the file or header.
export function rowErrors(error) {
  const list = error?.data?.errors;
  return Array.isArray(list) ? list.filter((e) => e && typeof e === "object") : [];
}

// Statuses for which the contract guarantees that nothing was written. Anything else
// (lost response, 5xx other than 503, an unreadable success body) leaves the result
// unknown: the server may have finished the import before the answer was lost.
const NOTHING_WRITTEN = new Set([401, 403, 409, 413, 415, 422, 503]);

export function importOutcomeKnown(error) {
  return NOTHING_WRITTEN.has(error?.status);
}

export function importErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return "Oturumunuzun süresi doldu. Yeniden giriş yapın; dosya yüklenmedi.";
    case 403:
      return "Bu işlem için yönetici yetkisi gerekir. Dosya yüklenmedi.";
    case 409:
      return "Dosyadaki bir kaynak kimliği mevcut bir kayıtla çakışıyor. Hiçbir kayıt yazılmadı.";
    case 413:
      return "Dosya sunucunun kabul ettiği 1.000.000 bayt sınırını aşıyor. Hiçbir kayıt yazılmadı.";
    case 415:
      return "Sunucu bu dosya türünü kabul etmedi. Yalnızca CSV (text/csv) veya JSON (application/json) yüklenebilir.";
    case 422:
      return "Dosya doğrulanamadı. Tüm dosya geri alındı; hiçbir kayıt yazılmadı.";
    case 503:
      return "İçe aktarım şu anda yapılamıyor (başka bir içe aktarım sürüyor ya da servis kullanılamıyor). Hiçbir kayıt yazılmadı; daha sonra kendiniz tekrar deneyin.";
    case 0:
      return "Sunucuya ulaşılamadı. Dosyanın işlenip işlenmediği bilinmiyor. Bağlantınızı kontrol edip aynı dosyayı yeniden yükleyebilirsiniz; aynı kaynak kimlikleri kayıtları çoğaltmaz.";
    default:
      return "Sunucudan doğrulanmış bir sonuç alınamadı. Kayıtların yazılıp yazılmadığı bilinmiyor; tesis listesini kontrol edin. Aynı dosyayı yeniden yüklemek kayıtları çoğaltmaz.";
  }
}
