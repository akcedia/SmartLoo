// Static render tests (react-dom/server), like the admin tests: no DOM library needed.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { authErrorMessage, validateRegistration, validateSignIn } from "./validation.js";
import SignInPage from "./SignInPage.jsx";
import RegisterPage from "./RegisterPage.jsx";
import RequireRole from "./RequireRole.jsx";
import AccountPage from "./AccountPage.jsx";
import AccountMenu from "../../app/AccountMenu.jsx";
import { routeFor } from "../../app/App.jsx";
import { safeReturnPath, signInPath } from "../../app/router.jsx";
import AdminRoute, { adminDataMode } from "../admin/AdminRoute.jsx";

const now = Math.floor(Date.now() / 1000);
const sessionFor = (role) => sessionFromToken(fakeJwt({ sub: `${role}-1`, role, iat: now, exp: now + 3600 }), `${role.toLowerCase()}@example.com`);
const withSession = (session, el) => renderToStaticMarkup(<SessionProvider initialSession={session}>{el}</SessionProvider>);

describe("form validation (FR-08 / REQ-SEC-01)", () => {
  it("accepts a valid registration", () => {
    expect(validateRegistration({ display_name: "Onur", email: "onur@example.com", password: "secret12" })).toEqual({});
  });

  it("rejects weak passwords, bad emails and display names outside 3–30", () => {
    const errors = validateRegistration({ display_name: "ab", email: "not-an-email", password: "short1" });
    expect(Object.keys(errors).sort()).toEqual(["display_name", "email", "password"]);
    expect(validateRegistration({ display_name: "x".repeat(31), email: "a@b.co", password: "lettersonly" })).toHaveProperty("password");
    expect(validateRegistration({ display_name: "abc", email: "a@b.co", password: "12345678" })).toHaveProperty("password");
    expect(validateRegistration({ display_name: "abc", email: "a@b.co", password: `${"ğ".repeat(36)}1` })).toHaveProperty("password");
  });

  it("requires both sign-in fields", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({ email: "E-posta gerekli.", password: "Parola gerekli." });
  });

  it("keeps the wrong-email and wrong-password messages identical (TC-40)", () => {
    expect(authErrorMessage({ status: 401 }, "sign-in")).toBe("E-posta veya parola hatalı.");
    expect(authErrorMessage({ status: 429 })).toMatch(/15 dakika/);
    expect(authErrorMessage({ status: 409 }, "register")).toMatch(/zaten kayıtlı/);
    expect(authErrorMessage({ status: 0 })).toMatch(/ulaşılamadı/);
  });
});

describe("auth screens", () => {
  it("renders labelled sign-in fields and a link to registration", () => {
    const html = withSession(null, <SignInPage />);
    expect(html).toContain("E-posta");
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).toContain('href="/register"');
  });

  it("confirms a completed registration on the sign-in screen", () => {
    expect(withSession(null, <SignInPage search="?registered=1" />)).toContain("Hesabınız oluşturuldu");
  });

  it("registration has no role field (TC-48) and shows the password policy", () => {
    const html = withSession(null, <RegisterPage />);
    expect(html).toContain("Görünen ad");
    expect(html).toContain("En az 8 karakter");
    expect(html).not.toMatch(/name="role"/);
  });

  it("account page shows email and role but never the token", () => {
    const session = sessionFor("USER");
    const html = withSession(session, <AccountPage />);
    expect(html).toContain("user@example.com");
    expect(html).toContain("Kullanıcı");
    expect(html).not.toContain(session.token);
  });
});

describe("role gate and admin route", () => {
  it("asks guests to sign in and remembers the page", () => {
    const html = withSession(null, <RequireRole role="ADMIN" path="/admin"><p>secret</p></RequireRole>);
    expect(html).toContain("Oturum gerekli");
    expect(html).toContain('href="/sign-in?next=%2Fadmin"');
    expect(html).not.toContain("secret");
  });

  it("shows 403 to a signed-in USER and renders no admin content", () => {
    const html = withSession(sessionFor("USER"), <RequireRole role="ADMIN" path="/admin"><p>secret</p></RequireRole>);
    expect(html).toContain("Yetkiniz yok");
    expect(html).not.toContain("secret");
  });

  it("lets a real ADMIN session through", () => {
    expect(withSession(sessionFor("ADMIN"), <RequireRole role="ADMIN"><p>secret</p></RequireRole>)).toContain("secret");
  });

  it("live admin route uses no sample data or demo controls", () => {
    const html = withSession(sessionFor("ADMIN"), <AdminRoute path="/admin" mode="live" />);
    expect(html).toContain("Yönetim Paneli");
    expect(html).not.toContain("ÖRNEK VERİ");
    expect(html).not.toContain("Demo senaryosu");
  });

  it("live admin route is gated for USER", () => {
    expect(withSession(sessionFor("USER"), <AdminRoute path="/admin" mode="live" />)).not.toContain("Yönetim Paneli");
  });

  it("sample mode is opt-in and labelled", () => {
    expect(adminDataMode({})).toBe("live");
    expect(adminDataMode({ VITE_ADMIN_DATA: "sample" })).toBe("sample");
    const html = withSession(null, <AdminRoute path="/admin" mode="sample" />);
    expect(html).toContain("ÖRNEK VERİ");
    expect(html).toContain("oturum ve yetki denetimi uygulanmaz");
  });
});

describe("header account menu", () => {
  it("offers sign-in with a return path for guests", () => {
    expect(renderToStaticMarkup(<AccountMenu session={null} onSignOut={() => {}} returnTo="/admin" />)).toContain('href="/sign-in?next=%2Fadmin"');
  });

  it("shows the signed-in user's name and role", () => {
    const html = renderToStaticMarkup(<AccountMenu session={sessionFor("ADMIN")} onSignOut={() => {}} />);
    expect(html).toContain("admin");
    expect(html).toContain("Yönetici");
    expect(html).toContain('aria-expanded="false"');
  });
});

describe("routing helpers", () => {
  it("maps paths to routes", () => {
    expect(["/", "/sign-in", "/register", "/account", "/admin", "/nope"].map(routeFor)).toEqual(["home", "sign-in", "register", "account", "admin", "not-found"]);
  });

  it("only returns to same-app paths after sign-in", () => {
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(signInPath("/")).toBe("/sign-in");
  });
});
