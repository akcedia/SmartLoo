# UI theme: light and dark (23 Nov 2026)

Owner: Onur (#58). Applies to every screen in `frontend/`. This replaces the
"Light Theme" line of UI Spec Lite: the app now has a light and a dark theme with
one shared token layer.

## Rules for every frontend change

- Colors come only from the `--sl-*` tokens in
  [`frontend/src/shared/theme/theme.css`](../../frontend/src/shared/theme/theme.css).
  Do not write hex/rgb colors in components or CSS files. In inline styles use the
  token as a string: `style={{ color: "var(--sl-text-muted)" }}`.
- `app.css` and `admin.css` keep their `--app-*` / `--admin-*` names as aliases of
  the same tokens; a test fails if a hex color appears in either file.
- The theme is `<html data-theme="light|dark">`. It is set before first paint by
  `frontend/index.html` and kept current by `shared/theme/theme.js`
  (header button: Sistem → Açık → Koyu, stored in `localStorage["smartloo.theme"]`;
  "Sistem" follows the OS). Do not add a second switch (`.dark` class or
  `prefers-color-scheme` blocks in component CSS).
- Every token pair used for text is measured in both themes by
  `frontend/src/app/a11y.test.jsx` (text >= 4.5:1, borders/fills >= 3:1).
  If you add a token pair, add it to that test.

## Token roles

| Role | Token |
|---|---|
| Page / panel / sunken / raised / hover backgrounds | `--sl-bg`, `--sl-surface`, `--sl-surface-sunken`, `--sl-surface-raised`, `--sl-surface-hover` |
| Borders: separators / inputs and controls | `--sl-border`, `--sl-border-strong` |
| Text: primary / secondary / muted / hint or disabled | `--sl-text`, `--sl-text-secondary`, `--sl-text-muted`, `--sl-text-faint` |
| Primary button fill / hover / its text | `--sl-accent-solid`, `--sl-accent-solid-hover`, `--sl-on-accent` |
| Links, selected text, soft selected background | `--sl-accent-text`, `--sl-accent-soft`, `--sl-accent-border` |
| Focus ring, button glow | `--sl-accent-ring`, `--sl-accent-glow` |
| Status (text / soft background / border) | `--sl-danger*`, `--sl-ok*`, `--sl-warn*` |
| AI content | `--sl-ai`, `--sl-ai-soft`, `--sl-ai-border` |
| Shadows | `--sl-shadow-sm`, `--sl-shadow-md`, `--sl-shadow-lg` |

Accent: cyan. Dark theme fills buttons with `#06B6D4` and dark text; light theme
fills with `#0E7490` and white text. One filled (accent) button per view; other
actions use the secondary style.

## Map

- OSM tiles are dimmed/inverted in dark mode by `--sl-map-tiles`; the attribution
  stays visible on a solid surface. Leaflet controls and popups follow the theme.
- The facility panel has "Yol tarifi al" (`features/map/DirectionsButton.jsx`):
  Android opens a `geo:` link so the phone's own app chooser appears; iPhone/iPad
  and desktops get a small menu (Apple / Google / Yandex Haritalar). Only the
  facility's coordinates and name are sent, never the user's location.
