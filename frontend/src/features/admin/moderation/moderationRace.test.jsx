// @vitest-environment jsdom
// Independent review: late responses must not cross the selected tab/facility.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import ModerationPanel from "./ModerationPanel.jsx";
import AdminFacilityStatus from "../../map/AdminFacilityStatus.jsx";
import { SessionProvider } from "../../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../../shared/session/sessionStore.js";
import { fakeJwt } from "../../../shared/session/testJwt.js";
import { MapApiProvider } from "../../map/MapApiProvider.jsx";

let host, root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const row = (id, status = "pending") => ({ id, name: id, status, latitude: 41, longitude: 29 });

it("does not append a late pending page to the approved tab", async () => {
  let finish;
  const api = { request: vi.fn(async (_path, { query }) => {
    if (query.status === "approved") return { count: 1, results: [row("Approved facility", "approved")] };
    if (query.offset > 0) return new Promise((resolve) => { finish = resolve; });
    return { count: 2, results: [row("First pending facility")] };
  }) };
  await act(async () => root.render(<ModerationPanel api={api} />));
  await settle();
  const more = [...host.querySelectorAll("button")].find((b) => b.textContent.startsWith("Daha fazla göster"));
  await act(async () => more.click());
  await act(async () => button("Onaylanan").click());
  await settle();
  expect(host.textContent).toContain("Approved facility");
  await act(async () => finish({ count: 2, results: [row("Late pending facility")] }));
  expect(host.textContent).not.toContain("Late pending facility");
  expect(host.querySelector(".admin-selection").textContent).toBe("1 öneri");
});

it.each([false, true])("does not show another facility's late status outcome (error=%s)", async (reject) => {
  let finish, fail;
  const fetchImpl = vi.fn(() => new Promise((resolve, rejection) => { finish = resolve; fail = rejection; }));
  const session = sessionFromToken(fakeJwt({ sub: "admin", role: "ADMIN", exp: Date.now() / 1000 + 3600 }), "admin@example.com");
  const changed = vi.fn();
  const render = async (id) => act(async () => root.render(
    <SessionProvider initialSession={session} fetchImpl={fetchImpl}><MapApiProvider>
      <AdminFacilityStatus toiletId={id} status="ACTIVE" onChanged={changed} />
    </MapApiProvider></SessionProvider>));
  await render("facility-A");
  await act(async () => button("Kapalı").click());
  await act(async () => button("“Kapalı” yap").click());
  expect(fetchImpl.mock.calls[0][0]).toContain("facility-A");
  await render("facility-B");
  await act(async () => reject ? fail(new Error("lost response")) : finish(Response.json({ id: "facility-A", status: "CLOSED" })));
  expect(changed).not.toHaveBeenCalled();
  expect(host.querySelector(".sl-admin-status-message")).toBeNull();
  expect(button("Aktif").disabled).toBe(false);
});
