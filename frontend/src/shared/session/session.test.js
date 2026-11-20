import { describe, expect, it } from "vitest";
import { isExpired, msUntilExpiry, readClaims } from "./token.js";
import { loadSession, saveSession, sessionFromToken } from "./sessionStore.js";
import { fakeJwt } from "./testJwt.js";

const now = Math.floor(Date.now() / 1000);
const adminToken = fakeJwt({ sub: "u-1", role: "ADMIN", iat: now, exp: now + 3600 });
const expiredToken = fakeJwt({ sub: "u-1", role: "USER", iat: now - 7200, exp: now - 3600 });

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe("token claims", () => {
  it("reads sub, role and exp from a JWT payload", () => {
    const claims = readClaims(adminToken);
    expect(claims).toMatchObject({ sub: "u-1", role: "ADMIN", exp: now + 3600 });
    expect(isExpired(claims)).toBe(false);
    expect(msUntilExpiry(claims, now * 1000)).toBe(3600 * 1000);
  });

  it("decodes UTF-8 claims", () => {
    expect(readClaims(fakeJwt({ sub: "ö-ğ", role: "USER", exp: now + 10 })).sub).toBe("ö-ğ");
  });

  it("rejects malformed tokens and tokens without required claims", () => {
    expect(readClaims("not-a-jwt")).toBeNull();
    expect(readClaims("a.%%%.c")).toBeNull();
    expect(readClaims(fakeJwt({ sub: "u-1", exp: now + 10 }))).toBeNull();
    expect(readClaims(null)).toBeNull();
  });

  it("treats a token at or past exp as expired", () => {
    expect(isExpired(readClaims(expiredToken))).toBe(true);
    expect(isExpired(null)).toBe(true);
  });
});

describe("session store", () => {
  it("builds a session with role and 60-minute expiry from the token", () => {
    const session = sessionFromToken(adminToken, "admin@example.com");
    expect(session).toMatchObject({ email: "admin@example.com", userId: "u-1", role: "ADMIN", expiresAt: (now + 3600) * 1000 });
  });

  it("never creates a session from an expired token", () => {
    expect(sessionFromToken(expiredToken, "a@example.com")).toBeNull();
  });

  it("saves only token and email, and restores the session", () => {
    const storage = memoryStorage();
    saveSession(sessionFromToken(adminToken, "admin@example.com"), storage);
    expect(JSON.parse(storage.data["smartloo.session"])).toEqual({ token: adminToken, email: "admin@example.com" });
    expect(loadSession(storage)).toMatchObject({ role: "ADMIN", email: "admin@example.com" });
  });

  it("drops an expired or corrupt saved session", () => {
    const expired = memoryStorage({ "smartloo.session": JSON.stringify({ token: expiredToken, email: "a@b.co" }) });
    expect(loadSession(expired)).toBeNull();
    expect(expired.data["smartloo.session"]).toBeUndefined();
    expect(loadSession(memoryStorage({ "smartloo.session": "{oops" }))).toBeNull();
  });

  it("clears storage on sign-out and survives blocked storage", () => {
    const storage = memoryStorage({ "smartloo.session": "x" });
    saveSession(null, storage);
    expect(storage.data["smartloo.session"]).toBeUndefined();
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(loadSession(blocked)).toBeNull();
    expect(() => saveSession(sessionFromToken(adminToken, "a@b.co"), blocked)).not.toThrow();
  });
});
