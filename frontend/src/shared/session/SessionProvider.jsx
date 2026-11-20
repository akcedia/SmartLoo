// One session for the whole app (map, reviews, admin). Owns the shared API
// client so every request carries the same token and a 401 ends the session
// everywhere at once.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "../http/apiClient.js";
import { loadSession, saveSession, sessionFromToken } from "./sessionStore.js";

const SessionContext = createContext(null);

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "";

export function SessionProvider({ children, initialSession, fetchImpl }) {
  const [session, setSession] = useState(() => (initialSession !== undefined ? initialSession : loadSession()));
  const [notice, setNotice] = useState(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const update = useCallback((next, message = null) => {
    setSession(next);
    saveSession(next);
    setNotice(message);
  }, []);

  const expire = useCallback(() => {
    if (sessionRef.current) update(null, "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.");
  }, [update]);

  const api = useMemo(
    () => createApiClient({ baseUrl: API_BASE_URL, getToken: () => sessionRef.current?.token ?? null, onUnauthorized: expire, fetchImpl }),
    [expire, fetchImpl],
  );

  // End the session exactly when the 60-minute token expires.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, expire]);

  const signIn = useCallback(
    async (email, password) => {
      const result = await api.request("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false });
      const next = sessionFromToken(result.access_token, email.trim().toLowerCase());
      if (!next) throw new Error("Sunucudan geçersiz oturum anahtarı alındı");
      update(next);
      return next;
    },
    [api, update],
  );

  const register = useCallback(
    (payload) => api.request("/api/v1/auth/register", { method: "POST", body: payload, auth: false }),
    [api],
  );

  // There is no server-side logout in FR-08: signing out drops the token here.
  const signOut = useCallback(() => update(null, "Çıkış yaptınız."), [update]);

  // Ends the session with a custom notice, e.g. after the account was deleted.
  const endSession = useCallback((message) => update(null, message), [update]);

  const value = useMemo(
    () => ({ session, notice, clearNotice: () => setNotice(null), api, signIn, register, signOut, endSession, expire }),
    [session, notice, api, signIn, register, signOut, endSession, expire],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
