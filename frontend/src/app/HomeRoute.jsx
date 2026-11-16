// Slot for the discovery map. Furkan's SearchPage (#54) replaces this
// placeholder once merged; it can read the shared session with useSession().

export default function HomeRoute() {
  return (
    <main className="app-page app-narrow">
      <h1>Harita</h1>
      <p className="app-muted">
        Harita ve arama ekranı (#54) bu rotaya bağlanacak. Ortak oturum ve HTTP istemcisi hazır:
        bileşenler <code>useSession()</code> ile oturuma ve <code>api.request()</code> ile backend'e erişebilir.
      </p>
    </main>
  );
}
