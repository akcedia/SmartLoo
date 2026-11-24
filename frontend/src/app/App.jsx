// Single SmartLoo React app: one header, one router, one session.
// Route ownership (#55/#58): entry, routing and the session client are Onur's;
// map, details and review components are Furkan's and plug into "/".

import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "../shared/session/SessionProvider.jsx";
import { Link, useLocation } from "./router.jsx";
import AccountMenu from "./AccountMenu.jsx";
import SettingsMenu from "../shared/settings/SettingsMenu.jsx";
import { I18nProvider, useI18n } from "../shared/i18n/I18nProvider.jsx";
import HomeRoute from "./HomeRoute.jsx";
import SignInPage from "../features/auth/SignInPage.jsx";
import RegisterPage from "../features/auth/RegisterPage.jsx";
import AccountPage from "../features/auth/AccountPage.jsx";
import RequireRole from "../features/auth/RequireRole.jsx";
import AdminRoute from "../features/admin/AdminRoute.jsx";
import SuggestionPage from "../features/suggestions/SuggestionPage.jsx";
import "./app.css";

export function routeFor(path) {
  if (path === "/" || path === "") return "home";
  if (path === "/sign-in") return "sign-in";
  if (path === "/register") return "register";
  if (path === "/account") return "account";
  if (path === "/suggest") return "suggest";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return "not-found";
}

function Header({ path }) {
  const { session, signOut } = useSession();
  const { t } = useI18n();
  return (
    <header className="app-topbar">
      <Link className="app-brand" to="/">
        <img className="app-brand-mark" src="/icons/icon-192.png?v=logo-20261124" width="36" height="36" alt="" />
        SmartLoo
      </Link>
      <nav className="app-topnav" aria-label={t("Ana menü")}>
        <Link to="/" aria-current={path === "/" ? "page" : undefined}>{t("Harita")}</Link>
        {session?.role === "ADMIN" && (
          <Link to="/admin" aria-current={routeFor(path) === "admin" ? "page" : undefined}>{t("Yönetim")}</Link>
        )}
      </nav>
      <SettingsMenu />
      <AccountMenu session={session} onSignOut={signOut} returnTo={path} />
    </header>
  );
}

function Notice() {
  const { notice, clearNotice } = useSession();
  const { t } = useI18n();
  if (!notice) return null;
  return (
    <div className="app-notice" role="status">
      <span>{t(notice)}</span>
      <button type="button" className="app-notice-close" onClick={clearNotice} aria-label={t("Bildirimi kapat")}>×</button>
    </div>
  );
}

// After client-side navigation, move focus to the new page's heading so keyboard
// and screen-reader users start at the new content (no full page load happens).
export function focusPageHeading(root) {
  const target = root?.querySelector("h1") ?? root;
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

function Routes() {
  const { path, search } = useLocation();
  const route = routeFor(path);
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  const { t } = useI18n();

  useEffect(() => {
    const titles = { home: "Harita", "sign-in": "Giriş yap", register: "Kayıt ol", account: "Hesabım", suggest: "Tesis öner", admin: "Yönetim", "not-found": "Sayfa bulunamadı" };
    document.title = `${t(titles[route])} · SmartLoo`;
  }, [route, t]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    focusPageHeading(mainRef.current);
  }, [path]);

  return (
    <div className={route === "home" ? "app app--full" : "app"}>
      <a className="app-skip" href="#main">{t("İçeriğe geç")}</a>
      <Header path={path} />
      <Notice />
      <div id="main" tabIndex={-1} ref={mainRef}>
        {route === "home" && <HomeRoute />}
        {route === "sign-in" && <SignInPage search={search} />}
        {route === "register" && <RegisterPage />}
        {route === "suggest" && <RequireRole path={path}><SuggestionPage /></RequireRole>}
        {route === "account" && (
          <RequireRole path={path}>
            <AccountPage />
          </RequireRole>
        )}
        {route === "admin" && <AdminRoute path={path} />}
        {route === "not-found" && (
          <main className="app-page app-narrow">
            <h1>{t("Sayfa bulunamadı")}</h1>
            <p><Link to="/">{t("Haritaya dön")}</Link></p>
          </main>
        )}
      </div>
    </div>
  );
}

export default function App({ initialLang, ...props }) {
  return (
    <I18nProvider initialLang={initialLang}>
      <SessionProvider {...props}>
        <Routes />
      </SessionProvider>
    </I18nProvider>
  );
}
