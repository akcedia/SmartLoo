// Single SmartLoo React app: one header, one router, one session.
// Route ownership (#55/#58): entry, routing and the session client are Onur's;
// map, details and review components are Furkan's and plug into "/".

import { useEffect } from "react";
import { SessionProvider, useSession } from "../shared/session/SessionProvider.jsx";
import { Link, useLocation } from "./router.jsx";
import AccountMenu from "./AccountMenu.jsx";
import HomeRoute from "./HomeRoute.jsx";
import SignInPage from "../features/auth/SignInPage.jsx";
import RegisterPage from "../features/auth/RegisterPage.jsx";
import AccountPage from "../features/auth/AccountPage.jsx";
import RequireRole from "../features/auth/RequireRole.jsx";
import AdminRoute from "../features/admin/AdminRoute.jsx";
import "./app.css";

export function routeFor(path) {
  if (path === "/" || path === "") return "home";
  if (path === "/sign-in") return "sign-in";
  if (path === "/register") return "register";
  if (path === "/account") return "account";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return "not-found";
}

function Header({ path }) {
  const { session, signOut } = useSession();
  return (
    <header className="app-topbar">
      <Link className="app-brand" to="/">
        <span className="app-brand-mark" aria-hidden="true">SL</span>
        SmartLoo
      </Link>
      <nav className="app-topnav" aria-label="Ana menü">
        <Link to="/" aria-current={path === "/" ? "page" : undefined}>Harita</Link>
        {session?.role === "ADMIN" && (
          <Link to="/admin" aria-current={routeFor(path) === "admin" ? "page" : undefined}>Yönetim</Link>
        )}
      </nav>
      <AccountMenu session={session} onSignOut={signOut} returnTo={path} />
    </header>
  );
}

function Notice() {
  const { notice, clearNotice } = useSession();
  if (!notice) return null;
  return (
    <div className="app-notice" role="status">
      <span>{notice}</span>
      <button type="button" className="app-notice-close" onClick={clearNotice} aria-label="Bildirimi kapat">×</button>
    </div>
  );
}

function Routes() {
  const { path, search } = useLocation();
  const route = routeFor(path);

  useEffect(() => {
    const titles = { home: "Harita", "sign-in": "Giriş yap", register: "Kayıt ol", account: "Hesabım", admin: "Yönetim", "not-found": "Sayfa bulunamadı" };
    document.title = `${titles[route]} · SmartLoo`;
  }, [route]);

  return (
    <div className="app">
      <a className="app-skip" href="#main">İçeriğe geç</a>
      <Header path={path} />
      <Notice />
      <div id="main" tabIndex={-1}>
        {route === "home" && <HomeRoute />}
        {route === "sign-in" && <SignInPage search={search} />}
        {route === "register" && <RegisterPage />}
        {route === "account" && (
          <RequireRole path={path}>
            <AccountPage />
          </RequireRole>
        )}
        {route === "admin" && <AdminRoute path={path} />}
        {route === "not-found" && (
          <main className="app-page app-narrow">
            <h1>Sayfa bulunamadı</h1>
            <p><Link to="/">Haritaya dön</Link></p>
          </main>
        )}
      </div>
    </div>
  );
}

export default function App(props) {
  return (
    <SessionProvider {...props}>
      <Routes />
    </SessionProvider>
  );
}
