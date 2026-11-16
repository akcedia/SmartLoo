// /admin route. Two clearly separate data modes:
// - live (default): real ADMIN session required, data from the summary/export
//   endpoints through the shared API client; no demo controls.
// - sample (VITE_ADMIN_DATA=sample): labelled sample adapter for UI review
//   without a backend. It applies no authorization and is never the live flow.

import { useMemo } from "react";
import { useSession } from "../../shared/session/SessionProvider.jsx";
import RequireRole from "../auth/RequireRole.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import { createHttpAdapter } from "./api/httpAdapter.js";

export function adminDataMode(env = import.meta.env ?? {}) {
  return env.VITE_ADMIN_DATA === "sample" ? "sample" : "live";
}

export default function AdminRoute({ path, mode = adminDataMode() }) {
  const { api } = useSession();
  const liveAdapter = useMemo(() => createHttpAdapter({ client: api }), [api]);

  if (mode === "sample") return <AdminDashboard />;

  return (
    <RequireRole role="ADMIN" path={path}>
      <AdminDashboard adapter={liveAdapter} />
    </RequireRole>
  );
}
