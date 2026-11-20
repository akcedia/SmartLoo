// Account screen. Account deletion (FR-10, DELETE /api/v1/users/me) is added
// when Fırat's endpoint exists; until then no deletion control is shown.

import { useSession } from "../../shared/session/SessionProvider.jsx";

const ROLE_LABELS = { ADMIN: "Yönetici", USER: "Kullanıcı" };

export default function AccountPage() {
  const { session, signOut } = useSession();
  const minutesLeft = Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000));
  return (
    <main className="app-page app-narrow">
      <h1>Hesabım</h1>
      <dl className="app-details">
        <dt>E-posta</dt>
        <dd>{session.email}</dd>
        <dt>Rol</dt>
        <dd>{ROLE_LABELS[session.role] ?? session.role}</dd>
        <dt>Oturum</dt>
        <dd>Yaklaşık {minutesLeft} dakika sonra sona erer (60 dakikalık oturum).</dd>
      </dl>
      <button type="button" className="app-button app-button--secondary" onClick={signOut}>Çıkış yap</button>
    </main>
  );
}
