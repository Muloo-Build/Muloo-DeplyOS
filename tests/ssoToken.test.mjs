import test from "node:test";
import assert from "node:assert/strict";

// Tests run against the compiled output (see root "test" script: tsc -b apps/api
// then node --test tests/*.test.mjs), matching the repo's dist-import convention.
const { signJwt, verifyJwt } = await import("../apps/api/dist/lib/ssoToken.js");

const SECRET = "test-secret-please-change-test-secret-32x";

test("round-trips claims and audience", () => {
  const token = signJwt({ aud: "hub-command", email: "a@b.co" }, SECRET, 120);
  const claims = verifyJwt(token, SECRET, "hub-command");
  assert.equal(claims.email, "a@b.co");
});

test("rejects wrong audience", () => {
  const token = signJwt({ aud: "deploy" }, SECRET, 120);
  assert.throws(() => verifyJwt(token, SECRET, "hub-command"), /bad audience/);
});

test("rejects tampered signature", () => {
  const token = signJwt({ aud: "hub-command" }, SECRET, 120);
  const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
  assert.throws(() => verifyJwt(tampered, SECRET, "hub-command"), /bad signature|bad audience|malformed/);
});

test("rejects expired token", () => {
  const token = signJwt({ aud: "hub-command" }, SECRET, -1);
  assert.throws(() => verifyJwt(token, SECRET, "hub-command"), /expired/);
});
