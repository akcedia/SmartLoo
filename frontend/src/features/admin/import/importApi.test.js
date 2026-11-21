import { describe, expect, it } from "vitest";
import { createApiClient } from "../../../shared/http/apiClient.js";
import {
  countCsvRecords,
  detectFormat,
  importErrorMessage,
  inspectImport,
  IMPORT_PATH,
  MAX_BYTES,
  rowErrors,
  uploadImport,
} from "./importApi.js";

const CSV_HEADER = "source,source_id,name,district,latitude,longitude";

function clientReturning(response) {
  const calls = [];
  const api = createApiClient({
    getToken: () => "admin-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return typeof response === "function" ? response() : response;
    },
  });
  return { api, calls };
}

describe("file checks before confirmation", () => {
  it("detects CSV and JSON by extension or type, rejects others", () => {
    expect(detectFormat({ name: "TESISLER.CSV" })).toBe("csv");
    expect(detectFormat({ name: "batch.json" })).toBe("json");
    expect(detectFormat({ name: "upload", type: "text/csv" })).toBe("csv");
    expect(detectFormat({ name: "data.xlsx", type: "application/vnd.ms-excel" })).toBeNull();
    expect(inspectImport({ text: "", size: 10, format: null }).problem).toMatch(/csv veya \.json/);
  });

  it("counts CSV records like a strict reader (quotes, CRLF, BOM, header excluded)", () => {
    const csv = `﻿${CSV_HEADER}\r\nexample,a,"Tesis, ""Moda""\nSahil",Kadıköy,41,29\r\nexample,b,Tesis B,Kadıköy,41,29\r\n`;
    expect(countCsvRecords(csv)).toBe(2);
    expect(countCsvRecords(`${CSV_HEADER}\n`)).toBe(0);
    expect(countCsvRecords(`${CSV_HEADER}\nexample,a,A,Kadıköy,41,29`)).toBe(1);
  });

  it("accepts a JSON array and rejects other JSON shapes", () => {
    const one = JSON.stringify([{ source: "example", source_id: "a" }]);
    expect(inspectImport({ text: one, size: one.length, format: "json" })).toEqual({ records: 1, problem: null });
    expect(inspectImport({ text: "{\"a\":1}", size: 7, format: "json" }).problem).toMatch(/dizi/);
    expect(inspectImport({ text: "[oops", size: 5, format: "json" }).problem).toMatch(/okunamadı/);
    expect(inspectImport({ text: "[]", size: 2, format: "json" }).problem).toMatch(/kayıt yok/);
  });

  it("enforces the 1,000,000-byte and 1000-record limits", () => {
    expect(inspectImport({ text: "", size: MAX_BYTES + 1, format: "csv" }).problem).toMatch(/1\.000\.000/);
    const many = `${CSV_HEADER}\n${Array.from({ length: 1001 }, (_, i) => `example,${i},T,Kadıköy,41,29`).join("\n")}`;
    expect(inspectImport({ text: many, size: many.length, format: "csv" }).problem).toMatch(/1000 kayıt/);
    expect(inspectImport({ text: "", size: 0, format: "csv" }).problem).toMatch(/boş/);
  });
});

describe("upload", () => {
  it("sends the file bytes unchanged with text/csv and returns the four counts", async () => {
    const { api, calls } = clientReturning(Response.json({ inserted: 1, updated: 0, unchanged: 0, rejected: 0 }));
    const content = `﻿${CSV_HEADER}\r\nexample,a,"A, Kadıköy",Kadıköy,41,29\r\n`;
    const file = new File([content], "batch.csv", { type: "text/csv" });
    await expect(uploadImport(api, { file, format: "csv" })).resolves.toEqual({ inserted: 1, updated: 0, unchanged: 0, rejected: 0 });
    expect(calls[0].url).toBe(IMPORT_PATH);
    expect(calls[0].init.method).toBe("POST");
    const sent = new Uint8Array(calls[0].init.body);
    expect(Array.from(sent)).toEqual(Array.from(new TextEncoder().encode(content)));
    expect(calls[0].init.headers["Content-Type"]).toBe("text/csv");
    expect(calls[0].init.headers.Authorization).toBe("Bearer admin-token");
  });

  it("uses application/json for JSON files", async () => {
    const { api, calls } = clientReturning(Response.json({ inserted: 0, updated: 1, unchanged: 1, rejected: 0 }));
    await uploadImport(api, { file: new File(["[]"], "b.json"), format: "json" });
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
  });

  it("refuses a success body without the contract counts", async () => {
    const { api } = clientReturning(Response.json({ ok: true }));
    await expect(uploadImport(api, { file: new File(["x"], "a.csv"), format: "csv" })).rejects.toMatchObject({ status: 502 });
  });

  it("keeps the top-level 422 errors array, including file-level row 0", async () => {
    const errors = [
      { row: 0, message: "Malformed UTF-8 CSV/JSON or invalid batch shape" },
      { row: 2, field: "latitude", message: "Latitude must be between -90 and 90" },
    ];
    const { api } = clientReturning(Response.json({ errors, atomic: true }, { status: 422 }));
    const error = await uploadImport(api, { file: new File(["x"], "a.csv"), format: "csv" }).catch((e) => e);
    expect(error.status).toBe(422);
    expect(rowErrors(error)).toEqual(errors);
    expect(importErrorMessage(error)).toMatch(/hiçbir kayıt yazılmadı/i);
  });

  it("gives every rejection status its own message and never claims partial success", () => {
    for (const status of [401, 403, 409, 413, 415, 422, 503, 0, 500]) {
      const message = importErrorMessage({ status });
      expect(message).not.toMatch(/kısmen|bazı kayıtlar yazıldı/i);
      expect(message.length).toBeGreaterThan(20);
    }
    expect(importErrorMessage({ status: 409 })).toMatch(/çakışıyor/);
    expect(importErrorMessage({ status: 413 })).toMatch(/1\.000\.000/);
    expect(importErrorMessage({ status: 415 })).toMatch(/text\/csv/);
    expect(importErrorMessage({ status: 503 })).toMatch(/kendiniz tekrar deneyin/);
    expect(rowErrors({ data: { detail: "x" } })).toEqual([]);
  });
});
