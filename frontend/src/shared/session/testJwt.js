// Test helper: an unsigned JWT-shaped token. The UI only reads claims; signatures are checked by the backend.
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

export function fakeJwt(claims) {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(claims)}.signature`;
}
