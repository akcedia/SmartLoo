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

export function adminSection(path = "") {
  if (path === "/admin/import") return "import";
  if (path === "/admin/moderation") return "moderation";
  return "analytics";
}

export default function AdminRoute({ path, mode = adminDataMode() }) {
  const { api } = useSession();
  const liveAdapter = useMemo(() => createHttpAdapter({ client: api }), [api]);

  const section = adminSection(path);
  if (mode === "sample") return <AdminDashboard section={section} />;

  return (
    <RequireRole role="ADMIN" path={path}>
      <AdminDashboard adapter={liveAdapter} section={section} importApi={api} />
    </RequireRole>
  );
}
