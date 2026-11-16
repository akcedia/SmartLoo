import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, fieldErrorsFrom } from "./apiClient.js";

function jsonResponse(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function setup(responder, token = "tok") {
  const calls = [];
  const onUnauthorized = vi.fn();
  const client = createApiClient({
    baseUrl: "http://api.test",
    getToken: () => token,
    onUnauthorized,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responder(url, init);
    },
  });
  return { client, calls, onUnauthorized };
}

describe("shared API client", () => {
  it("sends the Bearer token and drops empty query values", async () => {
    const { client, calls } = setup(() => jsonResponse(200, { ok: true }));
    await expect(client.request("/api/v1/x", { query: { district: "Kadıköy", from: "", to: null } })).resolves.toEqual({ ok: true });
    expect(calls[0].url).toBe("http://api.test/api/v1/x?district=Kad%C4%B1k%C3%B6y");
    expect(calls[0].init.headers.Authorization).toBe("Bearer tok");
  });

  it("does not attach a token to public auth calls and sends JSON bodies", async () => {
    const { client, calls } = setup(() => jsonResponse(201, { id: "1" }));
    await client.request("/api/v1/auth/register", { method: "POST", body: { email: "a@b.co" }, auth: false });
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.body).toBe('{"email":"a@b.co"}');
  });

  it("ends the session when a sent token is rejected with 401", async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, { detail: "Invalid or expired token" }));
    await expect(client.request("/api/v1/admin/metrics/summary")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not treat a failed sign-in (no token sent) as session expiry", async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, { detail: "Invalid email or password" }));
    await expect(client.request("/api/v1/auth/login", { method: "POST", body: {}, auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("keeps 403 distinct from 401", async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(403, { detail: "Administrator role required" }));
    await expect(client.request("/api/v1/admin/metrics/summary")).rejects.toMatchObject({ status: 403, message: "Administrator role required" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("maps FastAPI 422 details to field errors", async () => {
    const detail = [
      { loc: ["body", "password"], msg: "Value error, Password needs at least 8 characters, a letter and a digit" },
      { loc: ["query", "from"], msg: "Input should be a valid date" },
    ];
    const { client } = setup(() => jsonResponse(422, { detail }));
    const error = await client.request("/x").catch((e) => e);
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ password: "Password needs at least 8 characters, a letter and a digit", from: "Input should be a valid date" });
    expect(fieldErrorsFrom("not a list")).toEqual({});
  });

  it("reports network failure as status 0 and lets aborts through", async () => {
    const { client } = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(client.request("/x")).rejects.toMatchObject({ status: 0 });
    const abort = setup(() => {
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(abort.client.request("/x")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns the raw response for downloads and null for 204", async () => {
    const { client, calls } = setup(() => new Response("a,b\r\n", { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    const res = await client.request("/export", { raw: true });
    expect(await res.text()).toBe("a,b\r\n");
    expect(calls[0].init.headers.Accept).toBe("*/*");
    const empty = setup(() => new Response(null, { status: 204 }));
    await expect(empty.client.request("/users/me", { method: "DELETE" })).resolves.toBeNull();
  });

  it("handles non-JSON error bodies", async () => {
    const { client } = setup(() => new Response("<html>502</html>", { status: 502, statusText: "Bad Gateway" }));
    await expect(client.request("/x")).rejects.toMatchObject({ status: 502, message: "Bad Gateway", detail: null });
  });
});
