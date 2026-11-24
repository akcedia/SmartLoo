import { describe, expect, it } from "vitest";
import { densityAtZoom, selectVisibleMarkers } from "./markerDensity.js";

const view = { zoom: 10, south: 40, north: 42, west: 28, east: 30 };
const row = (id, extra = {}) => ({ id, name: id, latitude: 41, longitude: 29,
  average_cleanliness: null, review_count: 0, ...extra });
const project = (item) => ({ x: item.longitude * 10000, y: item.latitude * 10000 });

describe("adaptive marker presentation", () => {
  it("prioritizes actual mean rating, then review count, within a crowded cell", () => {
    const rows = [row("unrated"), row("popular", { average_cleanliness: 4, review_count: 100 }),
      row("best", { average_cleanliness: 5, review_count: 1 }), row("no-reviews", { average_cleanliness: 5 })];
    expect(selectVisibleMarkers(rows, view, project).rows.map((item) => item.id)).toEqual(["best"]);
    rows[2].average_cleanliness = 4;
    expect(selectVisibleMarkers(rows, view, project).rows[0].id).toBe("popular");
  });

  it("keeps an unrated source visible without inventing ratings", () => {
    const rows = Object.freeze(Array.from({ length: 500 }, (_, i) => Object.freeze(row(String(i), {
      latitude: 40.2 + (i % 20) * .08, longitude: 28.1 + Math.floor(i / 20) * .07,
    }))));
    const result = selectVisibleMarkers(rows, view, project);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(48);
    expect(result.totalInView).toBe(500);
    expect(result.limited).toBe(true);
    expect(result.rows.every((item) => item.average_cleanliness === null)).toBe(true);
    expect(rows).toHaveLength(500);
  });

  it("reveals more markers as zoom increases and shows the full local set up close", () => {
    const rows = Array.from({ length: 200 }, (_, i) => row(String(i), { longitude: 29 + i * .0001 }));
    const select = (zoom) => selectVisibleMarkers(rows, { ...view, zoom },
      (item) => ({ x: item.longitude * 2 ** zoom, y: item.latitude * 2 ** zoom }));
    expect(select(14).rows.length).toBeGreaterThan(select(10).rows.length);
    expect(select(16).rows).toHaveLength(200);
    expect(select(16).limited).toBe(false);
  });

  it("does not mount offscreen or invalid-coordinate facilities", () => {
    const rows = [row("visible"), row("outside", { latitude: 39 }), row("nan", { longitude: NaN }), row("invalid", { latitude: 95 })];
    expect(selectVisibleMarkers(rows, view, project).rows.map((item) => item.id)).toEqual(["visible"]);
  });

  it("retains the selected facility even when a higher-rated pin shares its cell", () => {
    const rows = [row("selected"), row("best", { average_cleanliness: 5, review_count: 8 })];
    expect(selectVisibleMarkers(rows, view, project, "selected").rows.map((item) => item.id)).toEqual(["selected"]);
    expect(selectVisibleMarkers(rows.slice(1), view, project, "selected").rows[0].id).toBe("best");
  });

  it("caps dense large results at every zoom without changing the full list", () => {
    const rows = Array.from({ length: 10000 }, (_, i) => row(String(i), {
      latitude: 40 + (i % 100) * .02, longitude: 28 + Math.floor(i / 100) * .02,
    }));
    for (const zoom of [9, 11, 12, 13, 14, 15, 16]) {
      const result = selectVisibleMarkers(rows, { ...view, zoom }, project);
      expect(result.rows.length).toBeLessThanOrEqual(densityAtZoom(zoom).limit);
      expect(result.totalInView).toBe(10000);
    }
    expect(rows).toHaveLength(10000);
  });
});
