// Presentation only: do not change the complete search/list/filter result set.
export function densityAtZoom(zoom) {
  if (zoom <= 10) return { cell: 100, limit: 48 };
  if (zoom <= 11) return { cell: 88, limit: 64 };
  if (zoom <= 12) return { cell: 72, limit: 100 };
  if (zoom <= 13) return { cell: 56, limit: 160 };
  if (zoom <= 14) return { cell: 40, limit: 240 };
  if (zoom <= 15) return { cell: 28, limit: 360 };
  return { cell: 0, limit: 500 };
}

function rating(row) {
  return Number.isFinite(row.average_cleanliness) && row.average_cleanliness >= 1
    && row.average_cleanliness <= 5 && row.review_count > 0 ? row.average_cleanliness : -1;
}

export function selectVisibleMarkers(rows, view, project, selectedId = null) {
  const { cell, limit } = densityAtZoom(view.zoom);
  const candidates = rows.filter((row) => {
    const lat = row.latitude, lon = row.longitude;
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      && lat >= view.south && lat <= view.north
      && (view.west <= view.east ? lon >= view.west && lon <= view.east : lon >= view.west || lon <= view.east);
  });
  candidates.sort((a, b) => rating(b) - rating(a)
    || (rating(a) >= 0 ? b.review_count - a.review_count : 0)
    || String(a.id).localeCompare(String(b.id)));
  const selected = candidates.find((row) => row.id === selectedId);
  const visible = [], occupied = new Set(), ids = new Set();
  const add = (row, force = false) => {
    if (ids.has(row.id) || visible.length >= limit) return;
    const point = project(row);
    const key = cell ? `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}` : null;
    if (!force && key !== null && occupied.has(key)) return;
    if (key !== null) occupied.add(key);
    ids.add(row.id);
    visible.push(row);
  };
  if (selected) add(selected, true);
  for (const row of candidates) add(row);
  return { rows: visible, totalInView: candidates.length, limited: visible.length < candidates.length };
}
