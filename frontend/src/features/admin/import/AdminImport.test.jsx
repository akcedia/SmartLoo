// @vitest-environment jsdom
// Interaction tests with a real DOM: file choice, confirmation, single request,
// counts and error states. The server is replaced by a scripted fetch.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiClient } from "../../../shared/http/apiClient.js";
import { SessionProvider } from "../../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../../shared/session/sessionStore.js";
import { fakeJwt } from "../../../shared/session/testJwt.js";
import AdminImport from "./AdminImport.jsx";
import AdminRoute from "../AdminRoute.jsx";

const CSV = "source,source_id,name,district,latitude,longitude\r\nexample,a,A,Kadıköy,41,29\r\nexample,b,B,Kadıköy,41,29\r\n";
let host;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  sessionStorage.clear();
});

function scriptedApi(responses) {
  const calls = [];
  const api = createApiClient({
    getToken: () => "admin-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next() : next;
    },
  });
  return { api, calls };
}

const text = () => host.textContent;
const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function choose(file) {
  const input = host.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await settle();
}

async function render(api) {
  await act(async () => root.render(<AdminImport api={api} />));
}

describe("ADMIN import screen", () => {
  it("has a labelled file input and states that unknown values stay unknown", async () => {
    await render(scriptedApi([]).api);
    const input = host.querySelector('input[type="file"]');
    expect(host.querySelector(`label[for="${input.id}"]`).textContent).toBe("Dosya");
    expect(input.getAttribute("accept")).toContain(".csv");
    expect(text()).toContain("hiçbir tesis kendiliğinden erişilebilir, ücretsiz veya açık sayılmaz");
  });

  it("asks for confirmation, sends one request even on double click, then shows all four counts", async () => {
    let release;
    const pending = new Promise((r) => { release = r; });
    const { api, calls } = scriptedApi([() => pending.then(() => Response.json({ inserted: 1, updated: 1, unchanged: 1, rejected: 0 }))]);
    await render(api);
    await choose(new File([CSV], "tesisler.csv", { type: "text/csv" }));
    expect(text()).toContain("Yüklemeyi onaylayın");
    expect(text()).toContain("tesisler.csv");
    expect(calls).toHaveLength(0);

    await act(async () => { button("Yüklemeyi onayla").click(); button("Yükleniyor…")?.click(); });
    expect(button("Yükleniyor…").disabled).toBe(true);
    expect(host.querySelector('input[type="file"]').disabled).toBe(true);
    release();
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0].init.headers["Content-Type"]).toBe("text/csv");
    expect(text()).toContain("İçe aktarım tamamlandı");
    for (const label of ["Eklenen", "Eşleşen", "Değişmeyen", "Reddedilen"]) expect(text()).toContain(label);
    expect(document.activeElement.textContent).toContain("İçe aktarım tamamlandı");
  });

  it("does not send anything for a non-array JSON file", async () => {
    const { api, calls } = scriptedApi([]);
    await render(api);
    await choose(new File(['{"source":"example"}'], "batch.json", { type: "application/json" }));
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/dizi/);
    expect(button("Yüklemeyi onayla")).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("shows 422 row errors, says nothing was written and does not retry", async () => {
    const errors = [{ row: 2, field: "latitude", message: "Latitude must be between -90 and 90" }];
    const { api, calls } = scriptedApi([Response.json({ errors, atomic: true }, { status: 422 })]);
    await render(api);
    await choose(new File([CSV], "hatali.csv", { type: "text/csv" }));
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    const alert = host.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("hiçbir kayıt yazılmadı");
    expect(alert.textContent).toContain("latitude");
    expect(alert.querySelector("tbody th").textContent).toBe("2");
    expect(text()).not.toContain("İçe aktarım tamamlandı");
    expect(button("Yüklemeyi onayla").disabled).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it.each([
    [409, "çakışıyor"],
    [413, "1.000.000"],
    [415, "text/csv"],
    [503, "kendiniz tekrar deneyin"],
  ])("explains %s without retrying", async (status, fragment) => {
    const { api, calls } = scriptedApi([Response.json({ detail: "x" }, { status })]);
    await render(api);
    await choose(new File([CSV], "a.csv", { type: "text/csv" }));
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    expect(host.querySelector('[role="alert"]').textContent).toContain(fragment);
    expect(calls).toHaveLength(1);
  });

  it("reports a network failure honestly", async () => {
    const { api } = scriptedApi([new TypeError("Failed to fetch")]);
    await render(api);
    await choose(new File([CSV], "a.csv", { type: "text/csv" }));
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    expect(host.querySelector('[role="alert"]').textContent).toContain("işlenip işlenmediği bilinmiyor");
  });
});

describe("file choice races (#81 review)", () => {
  // readFile resolves only when the test says so, to hold a read open.
  function deferredReader() {
    const pending = new Map();
    const readFile = (file) => new Promise((resolve) => pending.set(file.name, () => resolve(file.text())));
    return { readFile, finish: async (name) => { pending.get(name)(); await settle(); } };
  }

  async function chooseNow(file) {
    const input = host.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  }

  it("invalidates the old confirmation while a new file is read and sends only the new file", async () => {
    const reader = deferredReader();
    const { api, calls } = scriptedApi([Response.json({ inserted: 1, updated: 0, unchanged: 0, rejected: 0 })]);
    await act(async () => root.render(<AdminImport api={api} readFile={reader.readFile} />));
    const B = "source,source_id,name,district,latitude,longitude\r\nexample,b,B,Kadıköy,41,29\r\n";

    await chooseNow(new File([CSV], "a.csv", { type: "text/csv" }));
    await reader.finish("a.csv");
    expect(button("Yüklemeyi onayla").disabled).toBe(false);

    await chooseNow(new File([B], "b.csv", { type: "text/csv" }));
    expect(button("Yüklemeyi onayla")).toBeUndefined();
    expect(text()).toContain("Dosya okunuyor");
    expect(text()).not.toContain("a.csv");

    await reader.finish("b.csv");
    expect(text()).toContain("b.csv");
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    expect(calls).toHaveLength(1);
    expect(new TextDecoder().decode(calls[0].init.body)).toBe(B);
  });

  it("ignores a read that finishes after a newer choice or after Vazgeç", async () => {
    const reader = deferredReader();
    const { api, calls } = scriptedApi([]);
    await act(async () => root.render(<AdminImport api={api} readFile={reader.readFile} />));

    await chooseNow(new File([CSV], "old.csv", { type: "text/csv" }));
    await chooseNow(new File([CSV], "new.csv", { type: "text/csv" }));
    await reader.finish("new.csv");
    await reader.finish("old.csv");
    expect(text()).toContain("new.csv");
    expect(text()).not.toContain("old.csv");

    await act(async () => button("Vazgeç").click());
    await chooseNow(new File([CSV], "late.csv", { type: "text/csv" }));
    await act(async () => host.querySelector('input[type="file"]').dispatchEvent(new Event("change", { bubbles: true })));
    expect(button("Yüklemeyi onayla")).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("outcome titles (#81 review)", () => {
  async function failWith(response) {
    const { api } = scriptedApi([response]);
    await render(api);
    await choose(new File([CSV], "a.csv", { type: "text/csv" }));
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    return host.querySelector('[role="alert"] h3').textContent;
  }

  it("does not claim a rollback when the response was lost", async () => {
    expect(await failWith(new TypeError("Failed to fetch"))).toBe("İçe aktarım sonucu doğrulanamadı");
  });

  it("does not claim a rollback for an unexpected server error", async () => {
    expect(await failWith(Response.json({ detail: "x" }, { status: 500 }))).toBe("İçe aktarım sonucu doğrulanamadı");
  });

  it.each([409, 413, 415, 422, 503])("states that nothing was written for a definite %s", async (status) => {
    const body = status === 422 ? { errors: [], atomic: true } : { detail: "x" };
    expect(await failWith(Response.json(body, { status }))).toBe("İçe aktarım yapılmadı");
  });
});

describe("import route and session", () => {
  const now = Math.floor(Date.now() / 1000);
  const session = (role) => sessionFromToken(fakeJwt({ sub: `${role}-1`, role, iat: now, exp: now + 3600 }), `${role.toLowerCase()}@example.com`);

  async function renderRoute(current, fetchImpl) {
    await act(async () => root.render(
      <SessionProvider initialSession={current} fetchImpl={fetchImpl}>
        <AdminRoute path="/admin/import" mode="live" />
      </SessionProvider>,
    ));
  }

  it("opens the import tab for a real ADMIN session without requesting analytics", async () => {
    const requests = [];
    await renderRoute(session("ADMIN"), async (url) => { requests.push(url); return Response.json({}); });
    await settle();
    expect(text()).toContain("Tesis verisi içe aktar");
    expect(host.querySelector('[aria-current="page"]').textContent).toBe("İçe aktarım");
    expect(requests.filter((u) => u.includes("/metrics/summary"))).toHaveLength(0);
  });

  it("keeps USER and guests out (403 screen / sign-in)", async () => {
    await renderRoute(session("USER"), async () => Response.json({}));
    expect(text()).toContain("Yetkiniz yok");
    expect(host.querySelector('input[type="file"]')).toBeNull();
    // A fresh root: SessionProvider reads initialSession only when it mounts.
    act(() => root.unmount());
    root = createRoot(host);
    await renderRoute(null, async () => Response.json({}));
    expect(text()).toContain("Oturum gerekli");
    expect(host.querySelector('input[type="file"]')).toBeNull();
  });

  it("ends the session when the server rejects the token during upload", async () => {
    await renderRoute(session("ADMIN"), async (url) => (
      url.includes("/admin/import") ? Response.json({ detail: "Invalid or expired token" }, { status: 401 }) : Response.json({})
    ));
    await choose(new File([CSV], "a.csv", { type: "text/csv" }));
    await act(async () => button("Yüklemeyi onayla").click());
    await settle();
    expect(text()).toContain("Oturum gerekli");
    expect(sessionStorage.getItem("smartloo.session")).toBeNull();
  });
});
