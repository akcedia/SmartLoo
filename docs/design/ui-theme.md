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
| Focus ring | `--sl-accent-ring` |
| Second accent (pastel green): selected chips, switches, tabs | `--sl-accent2-solid`, `--sl-on-accent2`, `--sl-accent2-soft`, `--sl-accent2-text`, `--sl-accent2-border` |
| Status (text / soft background / border) | `--sl-danger*`, `--sl-ok*`, `--sl-warn*` |
| AI content | `--sl-ai`, `--sl-ai-soft`, `--sl-ai-border` |
| Shadows | `--sl-shadow-sm`, `--sl-shadow-md`, `--sl-shadow-lg` |

Accent: cyan. Dark theme fills buttons with `#06B6D4` and dark text; light theme
fills with `#0E7490` and white text. One filled (accent) button per view; other
actions use the secondary style. Selected states (chips, segmented switches, tabs,
settings choices) use the pastel green second accent. No glows: buttons use short,
plain shadows only. The dark theme uses near-black neutrals (`#030405` page).

## Settings (header gear menu)

`frontend/src/shared/settings/`: theme (Sistem/Açık/Koyu), language (TR/EN), how the
map opens (İstanbul geneli / Yakınımda, default radius), directions app (ask every
time / Apple / Google / Yandex) and "Hareketi azalt" (`<html data-motion="reduce">`).
Stored in this browser only (`preferences.js`). The directions menu offers "Bu seçimi
varsayılan yap"; a saved app opens directly and "Başka uygulama seç" resets it.

## Map

- The map keeps its original light OSM colours in both themes (decision 23 Nov:
  street names stay readable); only the interface around it is dark. Leaflet
  controls, popups and the attribution follow the theme.
- Layout (`features/map/map.css`): controls are grouped by job. Top left: view
  switch (Harita/Liste), İstanbul geneli / Yakınımda with a compact radius dropdown ("1 km ▾"). Next to it:
  Şu an açık, Ücretsiz and "Filtreler" (panel with the other filters, coverage note
  and Temizle). Bottom right: AI Önerileri and Konumum. Bottom left: zoom and data
  source. Buttons carry their own border; groups have no box. On phones the filter row folds
  behind an arrow button (closed by default, remembered), and filters, facility
  detail and AI suggestions open as bottom sheets; the list is full screen.
- Pins (`features/map/mapPins.js`): filled cyan = open now, cyan outline = opening
  hours unknown, grey = closed or not active; the selected pin is larger. The
  marker title states the same in words.
- The facility panel has "Yol tarifi al" (`features/map/DirectionsButton.jsx`):
  Android opens a `geo:` link so the phone's own app chooser appears; iPhone/iPad
  and desktops get a small menu (Apple / Google / Yandex Haritalar). Only the
  facility's coordinates and name are sent, never the user's location.
