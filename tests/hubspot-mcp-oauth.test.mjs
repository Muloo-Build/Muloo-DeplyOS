// INTEGRATION_ENCRYPTION_KEY is required by encryptSecret (no env file loaded in node:test runner)
process.env.INTEGRATION_ENCRYPTION_KEY ??= "test-integration-encryption-key-0001";

import assert from "node:assert/strict";
import test from "node:test";

const { mapTokenResponseToConnection, fetchHubSpotMcpTokenInfo } = await import(
  "../apps/api/dist/hubspotMcpOAuth.js"
);

test("mapTokenResponseToConnection builds an encrypted, expiring record", () => {
  const now = 1_700_000_000_000;
  const rec = mapTokenResponseToConnection(
    {
      access_token: "at-123",
      refresh_token: "rt-456",
      token_type: "bearer",
      expires_in: 1800,
    },
    { portalId: "42", hubDomain: "acme.hubspot.com", connectedEmail: "a@b.com" },
    now,
  );
  assert.strictEqual(rec.portalId, "42");
  assert.strictEqual(rec.connected, true);
  assert.strictEqual(rec.tokenType, "bearer");
  assert.strictEqual(rec.tokenExpiresAt.getTime(), now + 1800 * 1000);
  // tokens are ciphertext, not the raw value
  assert.notStrictEqual(rec.accessToken, "at-123");
  assert.match(rec.accessToken, /^v1:/);
  assert.notStrictEqual(rec.refreshToken, "rt-456");
});

test("mapTokenResponseToConnection stores scopes (defaults to empty array)", () => {
  const withScopes = mapTokenResponseToConnection(
    { access_token: "at-1" },
    { portalId: "7", scopes: ["crm.objects.contacts.read", "oauth"] },
  );
  assert.deepStrictEqual(withScopes.scopes, ["crm.objects.contacts.read", "oauth"]);

  const noScopes = mapTokenResponseToConnection({ access_token: "at-1" }, { portalId: "7" });
  assert.deepStrictEqual(noScopes.scopes, []);
});

test("fetchHubSpotMcpTokenInfo maps introspection metadata", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        active: true,
        hub_id: 12345,
        hub_domain: "acme.hubspot.com",
        user: "agent@acme.com",
        user_name: "Agent Smith",
        scopes: ["crm.objects.contacts.read", "oauth"],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  try {
    const info = await fetchHubSpotMcpTokenInfo("at-1");
    assert.strictEqual(info.hubId, "12345");
    assert.strictEqual(info.hubDomain, "acme.hubspot.com");
    assert.strictEqual(info.connectedEmail, "agent@acme.com");
    assert.strictEqual(info.connectedName, "Agent Smith");
    assert.deepStrictEqual(info.scopes, ["crm.objects.contacts.read", "oauth"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchHubSpotMcpTokenInfo splits a space-delimited scope string", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ active: true, hub_id: 1, scope: "a b c" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const info = await fetchHubSpotMcpTokenInfo("at-1");
    assert.deepStrictEqual(info.scopes, ["a", "b", "c"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchHubSpotMcpTokenInfo throws on an inactive token", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(() => fetchHubSpotMcpTokenInfo("at-1"), /introspect/i);
  } finally {
    globalThis.fetch = realFetch;
  }
});
