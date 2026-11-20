// Screen-level gate. This only decides what to render: hiding a screen is not
// security. Every protected API call is still checked by the backend (401/403).

import { useSession } from "../../shared/session/SessionProvider.jsx";
import { Link, signInPath } from "../../app/router.jsx";

export default function RequireRole({ role, path, children }) {
  const { session } = useSession();

  if (!session) {
    return (
      <main className="app-page app-narrow">
        <div className="app-alert app-alert--warn" role="alert">
          <h1>Oturum gerekli</h1>
          <p>Bu sayfayı görmek için giriş yapın.</p>
          <Link className="app-button" to={signInPath(path)}>Giriş yap</Link>
        </div>
      </main>
    );
  }

  if (role && session.role !== role) {
    return (
      <main className="app-page app-narrow">
        <div className="app-alert app-alert--warn" role="alert">
          <h1>Yetkiniz yok</h1>
          <p>Bu sayfa yalnızca yöneticiler içindir. Hiçbir yönetici verisi yüklenmedi.</p>
          <Link to="/">Haritaya dön</Link>
        </div>
      </main>
    );
  }

  return children;
}
