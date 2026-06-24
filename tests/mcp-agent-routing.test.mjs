import assert from "node:assert/strict";
import test from "node:test";

const { buildHubSpotMcpToolsetConfigs, HUBSPOT_MCP_DESTRUCTIVE_TOOLS } =
  await import("../apps/api/dist/hubspotMcpOAuth.js");

test("destructive HubSpot MCP tools are disabled in the toolset config", () => {
  const configs = buildHubSpotMcpToolsetConfigs();
  for (const name of HUBSPOT_MCP_DESTRUCTIVE_TOOLS) {
    assert.strictEqual(configs[name].enabled, false, `${name} must be disabled`);
  }
});
