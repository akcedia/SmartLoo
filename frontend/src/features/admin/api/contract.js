// Constants mirrored from docs/contracts/admin-analytics-api.md.
// Changing any of these is a contract change: agree it with the backend owner first.

export const SUMMARY_PATH = "/api/v1/admin/metrics/summary";
export const EXPORT_PATH = "/api/v1/admin/analytics/export";

export const TIMEZONE = "Europe/Istanbul";

// Strictly below this mean shows "Acil Müdahale Gerekli" (REQUIREMENTS.MD §3.6).
export const CRITICAL_THRESHOLD = 3.5;
export const CRITICAL_ALERT_TEXT = "Acil Müdahale Gerekli";

export const EXPORT_FORMATS = ["csv", "json"];
export const EXPORT_COLUMNS = [
  "facility_id",
  "district",
  "hygiene_score",
  "open_issues_count",
  "last_cleaned_at",
];

// Open question Q4: until the backend exposes a district list, use the 39 Istanbul districts.
export const ISTANBUL_DISTRICTS = [
  "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler",
  "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü",
  "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt",
  "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane",
  "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer",
  "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla",
  "Ümraniye", "Üsküdar", "Zeytinburnu",
];

export function isCritical(average) {
  return average !== null && average !== undefined && average < CRITICAL_THRESHOLD;
}

export class AdminApiError extends Error {
  constructor(status, message, detail = null) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.detail = detail;
  }
}
