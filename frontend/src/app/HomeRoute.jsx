// "/" — discovery map (Furkan's SearchPage, #54/#57) inside the shared shell.
// Loaded on demand: Leaflet needs a browser window, and the sign-in and admin
// pages should not download the map. The shared header already links to the
// admin panel, so SearchPage gets no onSwitchToAdmin.

import { lazy, Suspense } from "react";

import { MapApiProvider } from "../features/map/MapApiProvider.jsx";

const SearchPage = lazy(() => import("../features/map/SearchPage.jsx"));

export default function HomeRoute() {
  return (
    <main className="app-home">
      <h1 className="app-sr">Harita</h1>
      <Suspense fallback={<p className="app-page app-muted" role="status">Harita yükleniyor…</p>}>
        <MapApiProvider><SearchPage /></MapApiProvider>
      </Suspense>
    </main>
  );
}
