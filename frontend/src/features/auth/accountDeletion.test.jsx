import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createApiClient } from "../../shared/http/apiClient.js";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { DELETE_ACCOUNT_PATH, deleteAccount, deletionErrorMessage } from "./accountDeletion.js";
import AccountPage from "./AccountPage.jsx";

function clientReturning(response) {
  const calls = [];
  const onUnauthorized = vi.fn();
  const api = createApiClient({
    getToken: () => "user-token",
    onUnauthorized,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return typeof response === "function" ? response() : response;
    },
  });
  return { api, calls, onUnauthorized };
}

describe("account deletion request (FR-10, TC-34)", () => {
  it("sends DELETE /api/v1/users/me with the session token and accepts 204", async () => {
    const { api, calls } = clientReturning(new Response(null, { status: 204 }));
    await expect(deleteAccount(api)).resolves.toBeUndefined();
    expect(calls[0].url).toBe(DELETE_ACCOUNT_PATH);
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.headers.Authorization).toBe("Bearer user-token");
  });

  it("does not treat any other success status as a confirmed deletion", async () => {
    const { api } = clientReturning(Response.json({ ok: true }, { status: 200 }));
    await expect(deleteAccount(api)).rejects.toMatchObject({ status: 200 });
  });

  it("reports a server failure as unconfirmed and never as success", async () => {
    const { api } = clientReturning(Response.json({ detail: "Deletion incomplete" }, { status: 500 }));
    const error = await deleteAccount(api).catch((e) => e);
    expect(error.status).toBe(500);
    expect(deletionErrorMessage(error)).toMatch(/onaylanmadı/);
  });

  it("ends the session when the token is rejected", async () => {
    const { api, onUnauthorized } = clientReturning(Response.json({ detail: "Invalid or expired token" }, { status: 401 }));
    await expect(deleteAccount(api)).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("says the account was not deleted for 501 and network errors", () => {
    expect(deletionErrorMessage({ status: 501 })).toMatch(/silinmedi/);
    expect(deletionErrorMessage({ status: 0 })).toMatch(/silinmedi/);
  });
});

describe("account privacy screen", () => {
  const now = Math.floor(Date.now() / 1000);
  const session = sessionFromToken(fakeJwt({ sub: "u-1", role: "USER", iat: now, exp: now + 3600 }), "user@example.com");
  const render = (props) => renderToStaticMarkup(<SessionProvider initialSession={session}><AccountPage {...props} /></SessionProvider>);

  it("explains what deletion removes and keeps before any confirmation", () => {
    const html = render();
    expect(html).toContain("Hesabı sil");
    expect(html).toContain("Anonim");
    expect(html).toContain("puanlar istatistiklerde kalır");
    expect(html).toContain("geri alınamaz");
    expect(html).toContain("Hesabımı sil");
    expect(html).not.toContain('role="alertdialog"');
  });

  it("asks for explicit confirmation without inventing a password prompt", () => {
    const html = render({ initialStep: "confirming" });
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Evet, hesabımı sil");
    expect(html).toContain("Vazgeç");
    expect(html).not.toMatch(/type="password"/);
  });

  it("disables both actions while the request is running", () => {
    const html = render({ initialStep: "deleting" });
    expect(html).toContain("Siliniyor…");
    expect(html.match(/disabled=""/g).length).toBeGreaterThanOrEqual(3);
  });
});
