import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminDashboard from "./features/admin/AdminDashboard.jsx";
import SearchPage from "./features/map/SearchPage.jsx";

function RootApp() {
  const [view, setView] = useState(() =>
    window.location.pathname.startsWith("/admin") ? "admin" : "map"
  );

  if (view === "admin") {
    return (
      <div>
        <div style={{ padding: "8px 16px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>SmartLoo · Yönetim Paneli</span>
          <button
            type="button"
            onClick={() => setView("map")}
            style={{ padding: "4px 10px", borderRadius: "4px", border: "none", cursor: "pointer" }}
          >
            Haritaya Dön
          </button>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  return <SearchPage onSwitchToAdmin={() => setView("admin")} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
); 