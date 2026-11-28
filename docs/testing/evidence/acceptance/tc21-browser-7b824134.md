# TC-21 browser acceptance evidence — 24 November 2026

**Tested revision.** [Main 7b824134](https://github.com/akcedia/SmartLoo/tree/7b824134157c64913ec0ca8bdf2b25525992b190). Windows, Python 3.12.10, Node 26.13.1 and headless Edge 158.0.4370.33 at 1440 × 900. The production frontend build ran through the same-origin cloud factory and real FastAPI HTTP routes on loopback. The directory and facility detail used two synthetic in-memory facilities. External map tiles were blocked.

| Surface | Evidence |
| --- | --- |
| API-only catalog | The original TC-21 returned HTTP 501 at the first assertion and remains failed. |
| Cloud entry-point tests | 12 passed in `tests/test_cloud_app.py`. These cover the SPA shell, static assets, known direct routes, 404s and API routing. |
| Raw production home response | HTTP 200, HTML app shell with an empty React root before JavaScript. |
| Real browser after JavaScript | Seven checks passed. Leaflet loaded. Location, search radius and filter controls rendered. Two facility markers appeared. Mouse clicks opened and closed filters, opened facility A's details and closed the detail panel. |
| Detail data | The directory and detail requests returned 200. Facility A's panel displayed the detail-only test price of 12.50 TL. This distinguishes the fetched detail from the marker's directory data. |

[Browser receipt](tc21-browser-7b824134.json). Zero uncaught application JavaScript exceptions were recorded. Tile rendering, deployed data, geolocation permission, panning, zoom, mobile devices and visual accessibility were outside this pass.

For reproduction, build the frontend at this revision with `npm run build` and serve the build using `create_cloud_app(web_dir=..., state=...)`. Supply deterministic directory and detail fixtures through the existing application test seams. In a new desktop browser session, load `/`, wait for Leaflet and the fixture markers, exercise the filter and detail buttons with browser input, and record the directory and detail HTTP results. The focused catalog and cloud check can be repeated from the repository root.

```sh
python -m pytest tests/test_requirements.py::test_tc_21 tests/test_cloud_app.py -q --tb=short
```

The app shell and browser interaction support the map acceptance requirement on this local build. Keep the catalog failure visible while the team agrees on the HTTP shell and browser test surfaces. Neither the catalog nor the production UI changed in this report update.

## Separate #100 candidate confirmation

An independent Windows run of `python -m pytest tests/test_requirements.py -q --tb=short` at [#100 head 87726acc](https://github.com/akcedia/SmartLoo/tree/87726acc7d4b1152da101bab8d42f9c2d66174fd) reproduced **50 passed, 2 failed, 0 skipped**. TC-21 still returned 501 from the API-only factory. TC-28 made zero calls to the synthetic provider. #100 identifies two eligible reviews after input filtering, below the provider threshold. The original smoke catalog remains unchanged, and final provider acceptance stays open.
