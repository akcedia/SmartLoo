// Session persistence. Decision for review (#58): the token lives in
// sessionStorage, so a reload keeps the session but closing the tab ends it.
// It is never written to localStorage or cookies, and it is dropped at `exp`
// (60 minutes, FR-08). Storage may be unavailable (private mode): the session
// then lasts until reload.

import { isExpired, readClaims } from "./token.js";

const KEY = "smartloo.session";

function defaultStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function sessionFromToken(token, email) {
  const claims = readClaims(token);
  if (!claims || isExpired(claims)) return null;
  return { token, email, userId: claims.sub, role: claims.role, expiresAt: claims.exp * 1000 };
}

export function loadSession(storage = defaultStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? "null");
    const session = saved ? sessionFromToken(saved.token, saved.email) : null;
    if (!session) storage?.removeItem(KEY);
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session, storage = defaultStorage()) {
  try {
    if (session) storage?.setItem(KEY, JSON.stringify({ token: session.token, email: session.email }));
    else storage?.removeItem(KEY);
  } catch {
    // Storage blocked: keep the in-memory session only.
  }
}
