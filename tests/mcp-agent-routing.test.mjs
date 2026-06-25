import assert from "node:assert/strict";
import test from "node:test";

const {
  buildHubSpotMcpToolsetConfigs,
  HUBSPOT_MCP_DESTRUCTIVE_TOOLS,
  isDestructiveHubSpotMcpTool,
} = await import("../apps/api/dist/hubspotMcpOAuth.js");

test("curated destructive HubSpot MCP tools are disabled in the toolset config", async () => {
  const configs = await buildHubSpotMcpToolsetConfigs();
  for (const name of HUBSPOT_MCP_DESTRUCTIVE_TOOLS) {
    assert.strictEqual(configs[name].enabled, false, `${name} must be disabled`);
  }
});

test("isDestructiveHubSpotMcpTool flags destructive verbs, spares safe tools", () => {
  for (const name of [
    "delete_crm_objects",
    "batch_delete_crm_objects",
    "archive_object",
    "purge_records",
    "merge_crm_objects",
    "remove_property",
  ]) {
    assert.ok(isDestructiveHubSpotMcpTool(name), `${name} should be destructive`);
  }
  for (const name of [
    "get_crm_objects",
    "search_crm_objects",
    "manage_crm_objects",
    "get_user_details",
    "search_properties",
    "get_campaign_analytics",
  ]) {
    assert.ok(!isDestructiveHubSpotMcpTool(name), `${name} should be safe`);
  }
});

test("dynamic gate disables live destructive tools and leaves safe ones enabled", async () => {
  const liveTools = [
    { name: "get_crm_objects" },
    { name: "manage_crm_objects" },
    { name: "search_properties" },
    { name: "delete_crm_objects" }, // destructive — must be gated
    { name: "archive_engagements" }, // destructive — must be gated
  ];

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "initialize") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} }), {
        status: 200,
        headers: { "content-type": "application/json", "mcp-session-id": "sess-1" },
      });
    }
    if (body.method === "tools/list") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: liveTools } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // notifications/initialized
    return new Response(null, { status: 202 });
  };

  try {
    const configs = await buildHubSpotMcpToolsetConfigs({ token: "fake-token" });
    assert.strictEqual(configs.delete_crm_objects.enabled, false);
    assert.strictEqual(configs.archive_engagements.enabled, false);
    assert.ok(!("get_crm_objects" in configs), "safe read tool must stay enabled");
    assert.ok(!("manage_crm_objects" in configs), "safe write tool must stay enabled");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("dynamic gate parses SSE-framed tools/list responses", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "initialize") {
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} })}\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream", "mcp-session-id": "sess-2" },
      });
    }
    if (body.method === "tools/list") {
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        result: { tools: [{ name: "delete_pipeline" }, { name: "get_properties" }] },
      });
      return new Response(`event: message\ndata: ${payload}\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    return new Response(null, { status: 202 });
  };

  try {
    const configs = await buildHubSpotMcpToolsetConfigs({ token: "fake-token" });
    assert.strictEqual(configs.delete_pipeline.enabled, false);
    assert.ok(!("get_properties" in configs), "safe tool must stay enabled");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("dynamic gate falls back to curated denylist when live listing fails", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  try {
    const configs = await buildHubSpotMcpToolsetConfigs({ token: "fake-token" });
    for (const name of HUBSPOT_MCP_DESTRUCTIVE_TOOLS) {
      assert.strictEqual(configs[name].enabled, false, `${name} must remain disabled`);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});
