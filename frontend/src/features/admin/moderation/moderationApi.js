// FR-05 moderation and FR-10 facility status, through the shared session client.
// Contracts: docs/contracts/suggestions-api.md (#93) and PATCH /api/v1/admin/toilets/{id} (#94).
// Success is shown only for a 200 with the expected body; a lost response is reported
// as "unknown", never as done or not done.
import { ApiError } from "../../../shared/http/apiClient.js";

export const SUGGESTIONS_PATH = "/api/v1/admin/suggestions";
export const STATUSES = ["pending", "approved", "rejected"];
export const PAGE_SIZE = 50;

function isSuggestion(row) {
  return row && typeof row.id === "string" && STATUSES.includes(row.status) && typeof row.name === "string";
}

export async function listSuggestions(api, { status = "pending", offset = 0, limit = PAGE_SIZE, signal } = {}) {
  const data = await api.request(SUGGESTIONS_PATH, { query: { status, limit, offset }, signal });
  if (!data || !Array.isArray(data.results) || typeof data.count !== "number" || !data.results.every(isSuggestion)) {
    throw new ApiError(502, "Suggestion list does not match the contract");
  }
  return data;
}

export async function decideSuggestion(api, id, status) {
  const data = await api.request(`${SUGGESTIONS_PATH}/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
  if (!isSuggestion(data) || data.status !== status) throw new ApiError(502, "Decision response does not match the contract");
  return data;
}

export const FACILITY_STATUSES = ["ACTIVE", "MAINTENANCE", "CLOSED"];

export async function setFacilityStatus(api, toiletId, status) {
  const data = await api.request(`/api/v1/admin/toilets/${encodeURIComponent(toiletId)}`, { method: "PATCH", body: { status } });
  if (!data || data.status !== status) throw new ApiError(502, "Facility status response does not match the contract");
  return data;
}

/** Turkish messages (keys of the TR/EN catalog). */
export function decisionErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return "Oturumunuzun süresi doldu. Yeniden giriş yapın; karar kaydedilmedi.";
    case 403:
      return "Bu işlem için yönetici yetkisi gerekir. Karar kaydedilmedi.";
    case 404:
      return "Bu öneri artık bulunmuyor. Liste yenilendi.";
    case 409:
      return "Bu öneri zaten karara bağlanmış (başka bir yönetici karar vermiş olabilir). Liste yenilendi.";
    case 422:
      return "Sunucu bu kararı kabul etmedi. Karar kaydedilmedi.";
    default:
      return "Sunucudan doğrulanmış bir yanıt alınamadı. Kararın kaydedilip kaydedilmediği bilinmiyor; liste yenilendi, kontrol edin.";
  }
}

export function listErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return "Oturumunuzun süresi doldu. Öneri listesini görmek için yeniden giriş yapın.";
    case 403:
      return "Bu sayfa yalnızca yöneticiler içindir. Hiçbir öneri gösterilmedi.";
    case 501:
      return "Öneri servisi henüz bu sunucuda yok (501). Gösterilecek gerçek veri yok.";
    case 0:
      return "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
    default:
      return "Öneriler alınamadı. Tekrar deneyin.";
  }
}

export function facilityStatusErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return "Oturumunuzun süresi doldu. Yeniden giriş yapın; tesis durumu değişmedi.";
    case 403:
      return "Bu işlem için yönetici yetkisi gerekir. Tesis durumu değişmedi.";
    case 404:
      return "Tesis bulunamadı. Tesis durumu değişmedi.";
    case 422:
      return "Sunucu bu durumu kabul etmedi. Tesis durumu değişmedi.";
    case 503:
      return "Bu tesiste süren bir yorum işlemi var. Tesis durumu değişmedi; biraz sonra tekrar deneyin.";
    default:
      return "Sunucudan doğrulanmış bir yanıt alınamadı. Tesis durumunun değişip değişmediği bilinmiyor; detay yenilendi, kontrol edin.";
  }
}
