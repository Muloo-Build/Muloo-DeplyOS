import assert from "node:assert/strict";
import test from "node:test";

const { generateCodeVerifier, deriveCodeChallenge } = await import(
  "../apps/api/dist/hubspotMcpOAuth.js"
);

test("generateCodeVerifier returns a 43-128 char URL-safe string", () => {
  const v = generateCodeVerifier();
  assert.ok(v.length >= 43 && v.length <= 128, `length ${v.length}`);
  assert.match(v, /^[A-Za-z0-9\-._~]+$/);
});

test("deriveCodeChallenge matches the known RFC 7636 S256 vector", () => {
  // RFC 7636 Appendix B
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = deriveCodeChallenge(verifier);
  assert.strictEqual(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
