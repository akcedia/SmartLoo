// Provisional host until the shared React skeleton from #23 lands.
// Only the /admin route is mounted here; the map app (#26) owns "/".
import React from "react";
import { createRoot } from "react-dom/client";
import AdminDashboard from "./features/admin/AdminDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminDashboard />
  </React.StrictMode>,
);
