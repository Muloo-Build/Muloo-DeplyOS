// Upserts the workspaceProviderConnection row used by the HubSpot MCP OAuth flow.
// Run once per environment:
//   HUBSPOT_MCP_CLIENT_ID=... HUBSPOT_MCP_CLIENT_SECRET=... pnpm seed:hubspot-mcp
//
// Must be invoked from apps/api (the package script does this) so that
// @prisma/client resolves from apps/api/node_modules.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve @prisma/client from the api package regardless of where this file lives.
const apiDir = resolve(fileURLToPath(import.meta.url), "../../apps/api");
const require = createRequire(pathToFileURL(resolve(apiDir, "package.json")));
const { PrismaClient } = require("@prisma/client");

const clientId = process.env.HUBSPOT_MCP_CLIENT_ID?.trim();
const clientSecret = process.env.HUBSPOT_MCP_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "Set HUBSPOT_MCP_CLIENT_ID and HUBSPOT_MCP_CLIENT_SECRET before running this seed.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const row = await prisma.workspaceProviderConnection.upsert({
    where: { providerKey: "hubspot_mcp" },
    create: {
      providerKey: "hubspot_mcp",
      label: "HubSpot MCP",
      connectionType: "oauth",
      defaultModel: clientId,
      apiKey: clientSecret,
      isEnabled: true,
    },
    update: {
      defaultModel: clientId,
      apiKey: clientSecret,
      isEnabled: true,
    },
  });
  console.log(`Seeded hubspot_mcp provider connection (${row.id}).`);
} finally {
  await prisma.$disconnect();
}
