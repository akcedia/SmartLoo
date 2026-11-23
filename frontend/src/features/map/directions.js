// Directions links for a facility. Only the destination (the facility's own
// coordinates and name) leaves the app; the user's location is never added, so the
// maps app picks the start point itself with its own permission prompt.

export function validCoordinates(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: Number(la.toFixed(6)), lon: Number(lo.toFixed(6)) };
}

/** "android" | "ios" | "mac" | "other", from the browser's own user agent data. */
export function detectPlatform(nav = globalThis.navigator) {
  if (!nav) return "other";
  const ua = nav.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
  if (/Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Macintosh/i.test(ua)) return "mac";
  return "other";
}

/**
 * Android: one geo: link, which opens the system "open with" chooser listing every
 * installed maps app. iOS and desktop have no such system chooser, so the app
 * offers the providers itself (Apple first on Apple devices).
 */
export function directionsOptions({ lat, lon, name }, platform = detectPlatform()) {
  const point = validCoordinates(lat, lon);
  if (!point) return { geo: null, providers: [] };
  const where = `${point.lat},${point.lon}`;
  const label = (name || "").trim();
  const geo = `geo:${where}?q=${where}${label ? `(${encodeURIComponent(label)})` : ""}`;

  const apple = {
    id: "apple",
    label: "Apple Haritalar",
    href: `https://maps.apple.com/?daddr=${where}${label ? `&q=${encodeURIComponent(label)}` : ""}&dirflg=w`,
  };
  const google = {
    id: "google",
    label: "Google Haritalar",
    href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}&travelmode=walking`,
  };
  const yandex = {
    id: "yandex",
    label: "Yandex Haritalar",
    href: `https://yandex.com.tr/harita/?rtext=~${where}&rtt=pd`,
  };

  const appleFirst = platform === "ios" || platform === "mac";
  return {
    geo: platform === "android" ? geo : null,
    providers: appleFirst ? [apple, google, yandex] : [google, apple, yandex],
  };
}
