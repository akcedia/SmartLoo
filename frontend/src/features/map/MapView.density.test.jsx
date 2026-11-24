// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MapView from "./MapView.jsx";

const state = vi.hoisted(() => ({ zoom: 10, handlers: new Set(), fitBounds: vi.fn(), setView: vi.fn() }));
vi.mock("react-leaflet", async () => {
  const React = await import("react");
  const map = {
    fitBounds: state.fitBounds, setView: state.setView,
    getZoom: () => state.zoom,
    getBounds: () => ({ getSouth: () => 40, getNorth: () => 42, getWest: () => 28, getEast: () => 30, contains: () => true }),
    project: ([lat, lon], zoom) => ({ x: lon * 2 ** zoom, y: lat * 2 ** zoom }),
  };
  return { MapContainer: ({ children }) => <div>{children}</div>,
    Marker: ({ alt, children, eventHandlers }) => <button onClick={eventHandlers?.click}>{alt}{children}</button>,
    TileLayer: () => null, Circle: () => null, Popup: () => null, ZoomControl: () => null,
    useMap: () => map,
    useMapEvents: (handlers) => {
      React.useEffect(() => { state.handlers.add(handlers); return () => state.handlers.delete(handlers); }, [handlers]);
      return map;
    },
  };
});

let host, root;
const rows = Array.from({ length: 432 }, (_, i) => ({ id: String(i), name: `Facility ${i}`,
  latitude: 41 + (i % 20) * .004, longitude: 29 + Math.floor(i / 20) * .004,
  average_cleanliness: null, review_count: 0 }));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.zoom = 10; state.fitBounds.mockClear(); state.setView.mockClear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (toilets, center = { lat: 41, lon: 29 }, extra = {}) => act(async () => root.render(
  <MapView citywide toilets={toilets} searchCenter={center} onMapMoved={() => {}} onClearSelection={() => {}}
    onSelectToilet={() => {}} {...extra} />));

it("mounts a sparse overview, then reveals markers on actual zoom events", async () => {
  const selected = vi.fn();
  await render(rows, undefined, { onSelectToilet: selected });
  expect(host.querySelectorAll("button").length).toBeLessThanOrEqual(48);
  expect(host.querySelector('[role="status"]').textContent).toContain("/432");
  await act(async () => {
    state.zoom = 16;
    for (const handlers of state.handlers) handlers.zoomend?.();
  });
  expect(host.querySelectorAll("button")).toHaveLength(432);
  await act(async () => host.querySelector("button").click());
  expect(selected).toHaveBeenCalledOnce();
  expect(rows.some((row) => row === selected.mock.calls[0][0])).toBe(true);
});

it("preserves manual zoom for identical refreshed results and city-mode location updates", async () => {
  await render(rows);
  expect(state.fitBounds).toHaveBeenCalledTimes(1);
  await render(rows.map((row) => ({ ...row })), { lat: 41.2, lon: 29.2 });
  expect(state.fitBounds).toHaveBeenCalledTimes(1);
  await render(rows.slice(0, 10));
  expect(state.fitBounds).toHaveBeenCalledTimes(2);
});
