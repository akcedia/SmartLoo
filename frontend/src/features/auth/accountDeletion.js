// FR-10 account deletion: DELETE /api/v1/users/me (design: docs/design/sequence/account-deletion.md).
// Success is reported only for 204. Any other answer means the server did not
// confirm the deletion, so the UI must not claim the account is gone.

import { ApiError } from "../../shared/http/apiClient.js";

export const DELETE_ACCOUNT_PATH = "/api/v1/users/me";

export async function deleteAccount(api) {
  const res = await api.request(DELETE_ACCOUNT_PATH, { method: "DELETE", raw: true });
  if (res.status !== 204) {
    throw new ApiError(res.status, "Account deletion was not confirmed");
  }
}

export function deletionErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return "Oturumunuz geçersiz veya süresi dolmuş. Hesabınızı silmek için yeniden giriş yapın.";
    case 501:
      return "Hesap silme şu anda kullanılamıyor. Sunucu silme işlemini onaylamadı.";
    case 0:
      return "Sunucudan yanıt alınamadı; silme işlemi onaylanmadı. Bağlantınızı kontrol edip yeniden deneyin.";
    default:
      return "Hesap silme tamamlanamadı ve sunucu tarafından onaylanmadı. Hesabınızın silindiğini varsaymayın; tekrar deneyin.";
  }
}
