// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SuggestionPage, { validateSuggestion } from "./SuggestionPage.jsx";
import RequireRole from "../auth/RequireRole.jsx";
import { SessionProvider } from "../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../shared/session/sessionStore.js";
import { fakeJwt } from "../../shared/session/testJwt.js";
import { I18nProvider } from "../../shared/i18n/I18nProvider.jsx";

let root, host;
const session = sessionFromToken(fakeJwt({ sub: "user", role: "USER", exp: Math.floor(Date.now()/1000)+3600 }), "user@example.com");
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); localStorage.clear(); });
const mount = async (fetchImpl, signedIn = session, lang = "tr") => act(async () => root.render(
  <I18nProvider initialLang={lang}><SessionProvider initialSession={signedIn} fetchImpl={fetchImpl}>
    <RequireRole path="/suggest"><SuggestionPage /></RequireRole>
  </SessionProvider></I18nProvider>));
async function fill(name, value) {
  await act(async () => {
    const input = host.querySelector(`[name="${name}"]`);
    const type = input.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(type.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
const submit = async () => act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
const valid = async () => { for (const [name, value] of Object.entries({ name: "  Test WC  ", district: "Kadıköy", latitude: "41.001", longitude: "29" })) await fill(name,value); };

it("requires sign-in and retains the return path without sending data", async () => {
  const fetchImpl = vi.fn(); await mount(fetchImpl, null);
  expect(host.querySelector("form")).toBeNull();
  expect(host.querySelector('a[href*="next="]').getAttribute("href")).toContain("%2Fsuggest");
  expect(fetchImpl).not.toHaveBeenCalled();
});
it("rejects blank and out-of-range coordinates before sending and focuses the error", async () => {
  const fetchImpl = vi.fn(); await mount(fetchImpl); await valid(); await fill("latitude", "91"); await submit();
  expect(fetchImpl).not.toHaveBeenCalled(); expect(document.activeElement.name).toBe("latitude");
  expect(validateSuggestion({ name: "WC", district: "X", latitude: "", longitude: "29" }).latitude).toBeTruthy();
  expect(validateSuggestion({ name: "WC", district: "X", latitude: "41", longitude: "Infinity" }).longitude).toBeTruthy();
});
it("sends one authenticated suggestion, preserves false/null and waits for pending acknowledgement", async () => {
  let finish;
  const fetchImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  await mount(fetchImpl); await valid(); await fill("is_free", "false"); await fill("has_disabled_access", "true");
  await submit(); await submit();
  expect(fetchImpl).toHaveBeenCalledTimes(1); expect(host.querySelector("fieldset").disabled).toBe(true);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe("/api/v1/toilets/suggest"); expect(options.headers.Authorization).toBe(`Bearer ${session.token}`);
  expect(JSON.parse(options.body)).toEqual({ name: "Test WC", district: "Kadıköy", latitude:41.001, longitude:29,
    is_free:false, has_disabled_access:true, has_baby_changing:null });
  expect(host.querySelector('[role="status"]')).toBeNull();
  await act(async () => finish(Response.json({id:"pending-1",status:"pending"},{status:202})));
  expect(host.querySelector('[role="status"]').textContent).toContain("Henüz haritada yayımlanmadı");
  expect(host.querySelector("form")).toBeNull();
});
it.each([0,200,503])("does not claim success or retry automatically after an uncertain response (%s)", async (status) => {
  const fetchImpl = vi.fn(async () => { if (!status) throw new Error("lost response"); return Response.json({status:"pending",id:"x"},{status}); });
  await mount(fetchImpl); await valid(); await submit(); await submit();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="alert"]').textContent).toContain("doğrulanamadı");
  expect(host.querySelector("fieldset").disabled).toBe(true);
});
it("keeps editable values after 422 and translates the form in English", async () => {
  const fetchImpl = vi.fn(async () => Response.json({detail:[]},{status:422}));
  await mount(fetchImpl,session,"en"); await valid(); await submit();
  expect(host.querySelector("h1").textContent).toBe("Suggest a facility");
  expect(host.querySelector('[name="name"]').value).toBe("  Test WC  ");
  expect(host.querySelector("fieldset").disabled).toBe(false);
  expect(host.querySelector('[role="alert"]').textContent).toContain("could not be validated");
});
