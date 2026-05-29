import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string, headerB64: string, secret: string): string {
  return createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");
}

export function signJwt(claims: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const iat = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ iat, exp: iat + ttlSeconds, ...claims }));
  const sig = sign(payload, header, secret);
  return `${header}.${payload}.${sig}`;
}

export type VerifiedJwt = Record<string, unknown> & { aud?: string; exp?: number };

export function verifyJwt(token: string, secret: string, expectedAud: string): VerifiedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [headerB64, payloadB64, sig] = parts as [string, string, string];
  const expected = sign(payloadB64, headerB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad signature");
  const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as VerifiedJwt;
  if (claims.aud !== expectedAud) throw new Error("bad audience");
  if (typeof claims.exp === "number" && claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("token expired");
  }
  return claims;
}
