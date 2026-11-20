import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken, saveSession } from "../../shared/session/sessionStore.js";
import AccountPage from "./AccountPage.jsx";

const origin = process.env.SMARTLOO_LIVE_ORIGIN;
const facility = process.env.SMARTLOO_LIVE_TOILET;
let host, root;
const session = role => sessionFromToken(process.env[`SMARTLOO_LIVE_${role}`], process.env[`SMARTLOO_LIVE_${role}_EMAIL`]);
const request = (path, token, options = {}) => fetch(`${origin}/api/v1${path}`, {
  ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

function Screen() {
  const { session, notice } = useSession();
  return <>{notice && <p role="status">{notice}</p>}{session ? <AccountPage /> : <p>Misafir</p>}</>;
}

async function mount(current, fetchImpl = (path, init) => fetch(`${origin}${path}`, init)) {
  saveSession(current);
  await act(async () => root.render(<SessionProvider initialSession={current} fetchImpl={fetchImpl}><Screen /></SessionProvider>));
}
const button = label => [...host.querySelectorAll("button")].find(node => node.textContent === label);
const click = async label => act(async () => button(label).click());
async function settle(predicate) {
  for (let i = 0; i < 100; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    if (predicate()) return;
  }
  throw new Error(`Account screen did not settle: ${host.textContent}`);
}

beforeEach(() => {
  if (!origin || !facility) throw new Error("Run scripts/check_map_reviews_live.py --suite deletion");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", "/account");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
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

describe("Account screen with real PostgreSQL/MongoDB API", () => {
  it("cancels confirmation without deleting and restores keyboard focus", async () => {
    const current = session("OWNER");
    await mount(current);
    await click("Hesabımı sil");
    expect(document.activeElement).toBe(host.querySelector('[role="alertdialog"]'));
    await act(async () => host.querySelector('[role="alertdialog"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.activeElement).toBe(button("Hesabımı sil"));
    expect((await request(`/toilets/${facility}/reviews`, current.token)).status).toBe(200);
    expect(sessionStorage.getItem("smartloo.session")).not.toBeNull();
  });

  it("keeps session and focus on real 503 from pending author recovery", async () => {
    const current = session("OTHER");
    await mount(current);
    await click("Hesabımı sil");
    await click("Evet, hesabımı sil");
    await settle(() => !!host.querySelector('[role="alert"]'));
    expect(host.textContent).toContain("onaylanmadı");
    expect(sessionStorage.getItem("smartloo.session")).not.toBeNull();
    expect(document.activeElement).toBe(button("Hesabımı sil"));
    expect(window.location.pathname).toBe("/account");
    expect((await request(`/toilets/${facility}/reviews`, current.token)).status).toBe(200);
  });

  it("deletes on real 204, clears session, retains anonymous scores and rejects old login/token", async () => {
    const current = session("OWNER");
    const created = await request(`/toilets/${facility}/reviews`, current.token, { method: "POST", body: JSON.stringify({ cleanliness_score: 4, comment: `Temiz ${current.email}` }) });
    expect(created.status).toBe(201);
    await mount(current);
    await click("Hesabımı sil");
    await click("Evet, hesabımı sil");
    await settle(() => host.textContent.includes("Hesabınız silindi"));
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(host.textContent).toContain("Misafir");
    expect((await request(`/toilets/${facility}/reviews`, current.token)).status).toBe(401);
    const login = await request("/auth/login", null, { method: "POST", body: JSON.stringify({ email: current.email, password: "Guvenli123" }) });
    expect(login.status).toBe(401);
    const reviews = await (await request(`/toilets/${facility}/reviews`)).json();
    expect(reviews.count).toBe(1);
    expect(reviews.results[0].author).toBe("Anonymous");
    expect(reviews.results[0].cleanliness_score).toBe(4);
    expect(reviews.results[0].comment).not.toContain(current.email);
    const detail = await (await request(`/toilets/${facility}`)).json();
    expect(detail.average_cleanliness).toBe(4);
    expect(detail.review_count).toBe(1);
  });

  it("expires a restored stale session when deletion receives real 401", async () => {
    await mount(session("OWNER"));
    await click("Hesabımı sil");
    await click("Evet, hesabımı sil");
    await settle(() => host.textContent.includes("Misafir"));
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
    expect(host.textContent).toContain("Oturumunuzun süresi doldu");
    expect(host.textContent).not.toContain("Hesabınız silindi");
  });

  it("does not claim the account survived when the successful response is lost", async () => {
    let dropResponse = true;
    await mount(session("ADMIN"), async (path, init) => {
      const result = await fetch(`${origin}${path}`, init);
      if (dropResponse && init.method === "DELETE" && result.status === 204) {
        dropResponse = false;
        throw new Error("Synthetic lost response after committed deletion");
      }
      return result;
    });
    await click("Hesabımı sil");
    await click("Evet, hesabımı sil");
    await settle(() => !!host.querySelector('[role="alert"]'));
    expect(host.textContent).toContain("silme işlemi onaylanmadı");
    expect(host.textContent).not.toContain("Hesabınız silinmedi");
    expect(host.textContent).not.toContain("Hesabınız silindi");
    expect(sessionStorage.getItem("smartloo.session")).not.toBeNull();
    await click("Hesabımı sil");
    await click("Evet, hesabımı sil");
    await settle(() => host.textContent.includes("Misafir"));
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
  });
});
