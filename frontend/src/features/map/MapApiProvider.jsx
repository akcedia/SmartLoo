import { createContext, useContext, useMemo } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import { createToiletApi, getCurrentSessionUser } from "./toiletApi.js";

const MapApiContext = createContext({ ...createToiletApi(), getCurrentSessionUser });

export function MapApiProvider({ children }) {
  const { api, session } = useSession();
  const methods = useMemo(() => createToiletApi(api.request), [api]);
  const value = useMemo(() => ({
    ...methods,
    // Shared session client for ADMIN-only actions on the map (AdminFacilityStatus).
    request: api.request,
    getCurrentSessionUser: () => session
      ? { id: session.userId, role: session.role.toUpperCase(), email: session.email, displayName: "" }
      : null,
  }), [methods, session]);
  return <MapApiContext.Provider value={value}>{children}</MapApiContext.Provider>;
}

export function useMapApi() {
  return useContext(MapApiContext);
}
