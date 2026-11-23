// Screen-level gate. This only decides what to render: hiding a screen is not
// security. Every protected API call is still checked by the backend (401/403).

import { useSession } from "../../shared/session/SessionProvider.jsx";
import { Link, signInPath } from "../../app/router.jsx";
import { useI18n } from "../../shared/i18n/I18nProvider.jsx";

export default function RequireRole({ role, path, children }) {
  const { session } = useSession();
  const { t } = useI18n();

  if (!session) {
    return (
      <main className="app-page app-narrow">
        <div className="app-alert app-alert--warn" role="alert">
          <h1>{t("Oturum gerekli")}</h1>
          <p>{t("Bu sayfayı görmek için giriş yapın.")}</p>
          <Link className="app-button" to={signInPath(path)}>{t("Giriş yap")}</Link>
        </div>
      </main>
    );
  }

  if (role && session.role !== role) {
    return (
      <main className="app-page app-narrow">
        <div className="app-alert app-alert--warn" role="alert">
          <h1>{t("Yetkiniz yok")}</h1>
          <p>{t("Bu sayfa yalnızca yöneticiler içindir. Hiçbir yönetici verisi yüklenmedi.")}</p>
          <Link to="/">{t("Haritaya dön")}</Link>
        </div>
      </main>
    );
  }

  return children;
}
