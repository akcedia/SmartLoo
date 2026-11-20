// Reads JWT claims for display and expiry timing only.
// The signature is NOT verified here: the backend checks every request,
// so a tampered token can change what the UI shows but never what it may read.

function base64UrlDecode(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readClaims(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof claims.sub !== "string" || typeof claims.role !== "string" || typeof claims.exp !== "number") {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function msUntilExpiry(claims, now = Date.now()) {
  return claims.exp * 1000 - now;
}

export function isExpired(claims, now = Date.now()) {
  return !claims || msUntilExpiry(claims, now) <= 0;
}
