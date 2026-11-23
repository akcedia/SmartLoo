// Explicit live config only: scripts/check_map_reviews_live.py --suite import supplies a
// private test database, a real API, disposable accounts and a unique source namespace.
// Never point this at the live facility directory.
import React, { act } from "react";
import { existsSync, writeFileSync } from "node:fs";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SessionProvider } from "../../../shared/session/SessionProvider.jsx";
import { sessionFromToken } from "../../../shared/session/sessionStore.js";
import AdminRoute from "../AdminRoute.jsx";

const env = process.env;
const source = env.SMARTLOO_LIVE_IMPORT_SOURCE;
const csvRow = (id, name) => `${source},${id},${name},Kadıköy,41.0012,29.0034`;
const CSV_OK = `﻿source,source_id,name,district,latitude,longitude,is_free,status\r\n`
  + `${csvRow("csv-1", "Sentetik İçe Aktarım 1")},,ACTIVE\r\n`
  + `${csvRow("csv-2", "\"Sentetik, İçe Aktarım 2\"")},false,\r\n`;
const JSON_OK = JSON.stringify([
  { source, source_id: "json-1", name: "Sentetik JSON 1", district: "Kadıköy", latitude: 41.002, longitude: 29.004, has_disabled_access: null },
]);
const CSV_BAD_SECOND_ROW = "source,source_id,name,district,latitude,longitude\r\n"
  + `${csvRow("bad-1", "Yazılmamalı")}\r\n`
  + `${source},bad-2,Hatalı enlem,Kadıköy,95,29\r\n`;

it("ADMIN uploads CSV/JSON through the real API; repeats, bad rows, busy store and USER access behave", async () => {
  if (!env.SMARTLOO_LIVE_ORIGIN || !source) throw new Error("Use scripts/check_map_reviews_live.py --suite import");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const origin = env.SMARTLOO_LIVE_ORIGIN;
  const host = document.createElement("div");
  document.body.append(host);
  let root = createRoot(host);
  const requests = [];
  const fetchImpl = async (path, options) => {
    requests.push({ path, type: options?.headers?.["Content-Type"] });
    return fetch(`${origin}${path}`, options);
  };
  const text = () => host.textContent;
  const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  const settle = async (predicate, what) => {
    for (let n = 0; n < 200; n++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
      if (predicate()) return;
    }
    throw new Error(`Import screen did not reach "${what}": ${text()}`);
  };
  const counts = () => Object.fromEntries([...host.querySelectorAll(".admin-import-counts > div")]
    .map((d) => [d.querySelector("dt").textContent, Number(d.querySelector("strong").textContent)]));
  async function upload(name, body, type) {
    if (button("Başka dosya yükle")) await act(async () => button("Başka dosya yükle").click());
    if (button("Dosyayı düzelt ve yeniden seç")) await act(async () => button("Dosyayı düzelt ve yeniden seç").click());
    const input = host.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [new File([body], name, { type })], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await settle(() => button("Yüklemeyi onayla"), "confirmation");
    await act(async () => button("Yüklemeyi onayla").click());
    await settle(() => text().includes("İçe aktarım tamamlandı") || text().includes("İçe aktarım yapılmadı"), "outcome");
  }
  const mount = async (role) => {
    const session = sessionFromToken(env[`SMARTLOO_LIVE_${role}`], env[`SMARTLOO_LIVE_${role}_EMAIL`]);
    await act(async () => root.render(
      <SessionProvider initialSession={session} fetchImpl={fetchImpl}><AdminRoute path="/admin/import" mode="live" /></SessionProvider>,
    ));
  };

  try {
    await mount("ADMIN");
    await settle(() => host.querySelector('input[type="file"]'), "file input");
    expect(text()).not.toContain("ÖRNEK VERİ");

    // 1. Another import holds the shared mutex: real 503, nothing written, no automatic retry.
    const busyRequests = requests.length;
    await upload("mesgul.csv", CSV_OK, "text/csv");
    expect(text()).toContain("İçe aktarım yapılmadı");
    expect(text()).toContain("kendiniz tekrar deneyin");
    expect(requests.length - busyRequests).toBe(1);
    writeFileSync(`${env.SMARTLOO_LIVE_BUSY_FLAG}.done`, "ok");
    await settle(() => existsSync(`${env.SMARTLOO_LIVE_BUSY_FLAG}.released`), "mutex release");

    // 2. Valid CSV (BOM, quoted comma, unknown booleans as empty cells).
    await upload("tesisler.csv", CSV_OK, "text/csv");
    expect(counts()).toEqual({ Eklenen: 2, Eşleşen: 0, Değişmeyen: 0, Reddedilen: 0 });
    expect(requests.at(-1)).toMatchObject({ path: "/api/v1/admin/import", type: "text/csv" });

    // 3. The same file again: matched, unchanged, no duplicates.
    await upload("tesisler.csv", CSV_OK, "text/csv");
    expect(counts()).toEqual({ Eklenen: 0, Eşleşen: 2, Değişmeyen: 2, Reddedilen: 0 });

    // 4. Valid JSON array.
    await upload("tesis.json", JSON_OK, "application/json");
    expect(counts()).toEqual({ Eklenen: 1, Eşleşen: 0, Değişmeyen: 0, Reddedilen: 0 });
    expect(requests.at(-1).type).toBe("application/json");

    // 5. Second row invalid: 422 with the row error, whole batch rolled back (checked in SQL by the runner).
    await upload("hatali.csv", CSV_BAD_SECOND_ROW, "text/csv");
    const alert = host.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("hiçbir kayıt yazılmadı");
    expect([...alert.querySelectorAll("tbody th")].map((th) => th.textContent)).toContain("2");
    expect(text()).not.toContain("İçe aktarım tamamlandı");

    // 6. A real USER session sees no upload form, and the API refuses the user's token.
    act(() => root.unmount());
    root = createRoot(host);
    await mount("OWNER");
    await settle(() => text().includes("Yetkiniz yok"), "403 screen");
    expect(host.querySelector('input[type="file"]')).toBeNull();
    const direct = await fetch(`${origin}/api/v1/admin/import`, {
      method: "POST", body: CSV_OK, headers: { "Content-Type": "text/csv", Authorization: `Bearer ${env.SMARTLOO_LIVE_OWNER}` },
    });
    expect(direct.status).toBe(403);
    const guest = await fetch(`${origin}/api/v1/admin/import`, { method: "POST", body: CSV_OK, headers: { "Content-Type": "text/csv" } });
    expect(guest.status).toBe(401);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
}, 60_000);
