// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken, saveSession } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import AccountMenu from "../../app/AccountMenu.jsx";
import { MapApiProvider, useMapApi } from "./MapApiProvider.jsx";
import ReviewSection from "./ReviewSection.jsx";

let root, host, mapApi;
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const session = (role = "USER") => sessionFromToken(fakeJwt({ sub: "owner", role, exp: Date.now() / 1000 + 3600 }), "owner@example.com");
const review = { id: "review-1", cleanliness_score: 4, comment: "Temiz", is_own: true, can_edit: true, can_delete: true };

function Probe() {
  mapApi = useMapApi();
  const { session, signOut, notice } = useSession();
  return <><AccountMenu session={session} onSignOut={signOut} returnTo="/" /><p>{notice}</p></>;
}

async function render(initialSession, fetchImpl, toiletId = "facility-1") {
  await act(async () => root.render(
    <SessionProvider initialSession={initialSession} fetchImpl={fetchImpl}>
      <MapApiProvider><Probe /><ReviewSection toiletId={toiletId} /></MapApiProvider>
    </SessionProvider>,
  ));
}

const buttons = () => [...host.querySelectorAll("button")].map(el => el.textContent);
const button = label => [...host.querySelectorAll("button")].find(el => el.textContent === label);
const click = async label => { await act(async () => button(label).click()); };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Shared session and mounted review controls", () => {
  it.each([
    ["owner", "USER", review, true, true],
    ["other user", "USER", { ...review, is_own: false, can_edit: false, can_delete: false }, false, false],
    ["admin", "ADMIN", { ...review, is_own: false, can_edit: false }, false, true],
  ])("shows the backend permissions for %s", async (_, role, item, edit, remove) => {
    const current = session(role);
    const fetchImpl = vi.fn(async () => response({ results: [item] }));
    await render(current, fetchImpl);
    expect(buttons().includes("Düzenle")).toBe(edit);
    expect(buttons().includes("Sil")).toBe(remove);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${current.token}`);
  });

  it("a rejected review token signs out the header and review form together", async () => {
    const current = session();
    saveSession(current);
    await render(current, async () => response({ detail: "Invalid token" }, 401));
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
    expect(host.querySelector(".app-signin").textContent).toBe("Giriş yap");
    expect(host.textContent).toContain("Oturumunuzun süresi doldu");
    expect(buttons()).toContain("Giriş Yap");
    expect(host.textContent).not.toContain("Yeni Değerlendirme Yaz");
  });

  it("guest reads omit credentials and a guest 401 does not create an expiry notice", async () => {
    const fetchImpl = vi.fn(async () => response({ detail: "Unavailable" }, 401));
    await render(null, fetchImpl);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(host.textContent).not.toContain("Oturumunuzun süresi doldu");
  });

  it("uses the in-memory session even when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    const current = session();
    const fetchImpl = vi.fn(async () => response({ results: [review] }));
    await render(current, fetchImpl);
    expect(buttons()).toContain("Düzenle");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${current.token}`);
  });

  it("signing out removes author actions without remounting the detail panel", async () => {
    await render(session(), async () => response({ results: [review] }));
    await act(async () => host.querySelector(".app-account-button").click());
    await click("Çıkış yap");
    expect(buttons()).not.toContain("Düzenle");
    expect(buttons()).not.toContain("Sil");
    expect(buttons()).toContain("Giriş Yap");
  });

  it("keeps the session on 403 and displays a failed delete without hiding the review", async () => {
    const current = session();
    saveSession(current);
    await render(current, async (_, opts) => opts.method === "DELETE"
      ? response({ detail: "Forbidden" }, 403) : response({ results: [review] }));
    await click("Sil");
    expect(host.textContent).toContain("yetkiniz yok (403)");
    expect(host.textContent).toContain("Temiz");
    expect(sessionStorage.getItem("smartloo.session")).not.toBeNull();
  });
});

// The live runner provisions isolated PostgreSQL/Mongo data and real JWTs.
// Normal CI exercises the deterministic cases above; no skipped live test is reported.
if (process.env.SMARTLOO_LIVE_ORIGIN) {
  it("real FastAPI/PostGIS/Mongo: author edit/delete, other user denied, admin delete-only, refreshed aggregates", async () => {
    const origin = process.env.SMARTLOO_LIVE_ORIGIN;
    const id = process.env.SMARTLOO_LIVE_TOILET;
    const author = sessionFromToken(process.env.SMARTLOO_LIVE_OWNER, "owner@example.com");
    const other = sessionFromToken(process.env.SMARTLOO_LIVE_OTHER, "other@example.com");
    const admin = sessionFromToken(process.env.SMARTLOO_LIVE_ADMIN, "admin@example.com");
    const fetchImpl = (path, opts) => fetch(`${origin}${path}`, opts);
    const settle = async predicate => {
      for (let n = 0; n < 100; n++) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
        if (predicate()) return;
      }
      throw new Error(`UI did not settle: ${host.textContent}`);
    };
    await render(author, fetchImpl, id);
    await settle(() => host.textContent.includes("henüz yorum yapılmamış"));
    await click("Gönder");
    await settle(() => buttons().includes("Düzenle"));
    const own = (await mapApi.fetchToiletReviews(id))[0];
    expect(own.is_own).toBe(true);
    expect(own).not.toHaveProperty("user_id");
    await click("Düzenle");
    await act(async () => {
      const select = host.querySelector('select[aria-label="Hijyen puanı"]');
      select.value = "2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Güncelle");
    await settle(() => host.textContent.includes("güncellendi") && host.textContent.includes("2 / 5"));
    expect((await mapApi.fetchToiletDetail(id)).average_cleanliness).toBe(2);

    await act(async () => root.unmount());
    root = createRoot(host);
    await render(other, fetchImpl, id);
    await settle(() => host.textContent.includes("2 / 5"));
    expect(buttons()).not.toContain("Düzenle");
    expect(buttons()).not.toContain("Sil");
    await expect(mapApi.updateReview(own.id, { cleanliness_score: 1 })).rejects.toMatchObject({ status: 403 });

    await act(async () => root.unmount());
    root = createRoot(host);
    await render(admin, fetchImpl, id);
    await settle(() => buttons().includes("Sil"));
    expect(buttons()).not.toContain("Düzenle");

    await act(async () => root.unmount());
    root = createRoot(host);
    await render(author, fetchImpl, id);
    await settle(() => buttons().includes("Sil"));
    await click("Sil");
    await settle(() => host.textContent.includes("henüz yorum yapılmamış"));
    const detail = await mapApi.fetchToiletDetail(id);
    expect(detail.review_count).toBe(0);
    expect(detail.average_cleanliness).toBeNull();

    // A parseable token with an invalid signature must end the whole session
    // when rejected by the real server, not just show a local review error.
    await act(async () => root.unmount());
    root = createRoot(host);
    const rejected = { ...author, token: `${author.token.split(".").slice(0, 2).join(".")}.invalid-signature` };
    saveSession(rejected);
    await render(rejected, fetchImpl, id);
    await settle(() => host.textContent.includes("Oturumunuzun süresi doldu"));
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
    expect(host.querySelector(".app-signin").textContent).toBe("Giriş yap");
    expect(buttons()).toContain("Giriş Yap");
  }, 20000);
}
