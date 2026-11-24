# Map density and initial theme review — 24 Nov 2026

Base: main `7b824134157c64913ec0ca8bdf2b25525992b190`.
Local branch: `fix/map-density-light-default`.

## Change

Only viewport markers are drawn, with spatial thinning and increasing caps as
zoom increases. Valid review averages take priority, then review count; unrated
facilities remain available. Selection is retained. Full list/filter results and
counts are not truncated. Citywide refetches with identical coordinates and late
location updates no longer reset manual zoom.

Fresh visits default to light before first paint. Explicit dark/system/light
preferences are remembered; invalid or blocked storage falls back to light.

## Verification

- `npm test`: 23 files, **295 passed**, exit 0.
- `npm run build`: **124 modules transformed**, built successfully, exit 0.
- Pure density cases cover ranking, unrated data, offscreen/invalid coordinates,
  selected facilities, increasing zoom density and caps over 10,000 rows.
- Mounted React tests cover zoom events, selection callbacks and preserving zoom
  across identical citywide results/location changes.
- Local Brave preview with the public API's 432 records: overview 16 markers;
  two zoom increments 44 markers out of 327 in-view candidates, stable afterward.
  The full list remains available. At 375x812, no horizontal overflow.
- Fresh light, explicit dark, dark persistence after reload and reverting to
  light were checked in the browser; bootstrap/storage cases also have tests.

This verifies reduced marker work, not a measured FPS improvement or compliance
with the separate backend latency target. No API/model requests that mutate data,
database migrations, GitHub writes or cloud deployment were performed.

Screenshots remain local under ignored `.venv/map-overview.png`,
`.venv/map-zoomed.png` and `.venv/map-mobile.png`.

## Next step

Ask for approval to push this branch and open a PR. Review and merge separately;
coordinate any production release with the pending migration and AI release work.
