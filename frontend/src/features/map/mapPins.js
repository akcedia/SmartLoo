// Map pins drawn as SVG (Leaflet divIcon), coloured by what is actually known:
//   open     – is_open_now === true                       → filled cyan
//   closed   – is_open_now === false, or not ACTIVE        → grey
//   unknown  – opening hours not in the source (null)      → cyan outline, white inside
// Colour is never the only signal: the three states also differ in fill and the
// marker title says the state in words. Styles: map.css (.sl-pin…).
import L from "leaflet";

export function pinState(toilet) {
  if (!toilet) return "unknown";
  if (toilet.status && toilet.status !== "ACTIVE") return "closed";
  if (toilet.is_open_now === true) return "open";
  if (toilet.is_open_now === false) return "closed";
  return "unknown";
}

export const PIN_STATE_LABELS = {
  open: "Şu an açık",
  closed: "Kapalı veya hizmet dışı",
  unknown: "Açılış saati bilinmiyor",
};

const PIN_SVG = `
<svg viewBox="0 0 32 42" aria-hidden="true" focusable="false">
  <path class="sl-pin-body" d="M16 1.5C8 1.5 1.5 7.8 1.5 15.7c0 10.3 12.2 22.6 13.4 23.8a1.6 1.6 0 0 0 2.2 0C18.3 38.3 30.5 26 30.5 15.7 30.5 7.8 24 1.5 16 1.5z"/>
  <text class="sl-pin-label" x="16" y="19.6" text-anchor="middle">WC</text>
</svg>`;

const cache = new Map();

export function pinIcon(state, selected = false) {
  const key = `${state}:${selected}`;
  if (!cache.has(key)) {
    const size = selected ? [40, 52] : [30, 40];
    cache.set(
      key,
      L.divIcon({
        className: `sl-pin sl-pin--${state}${selected ? " sl-pin--selected" : ""}`,
        html: PIN_SVG,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] - 1],
        popupAnchor: [0, -size[1] + 6],
      }),
    );
  }
  return cache.get(key);
}

export const userLocationIcon = L.divIcon({
  className: "sl-user-dot",
  html: '<span class="sl-user-dot-pulse" aria-hidden="true"></span><span class="sl-user-dot-core" aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
