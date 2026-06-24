import crypto from "node:crypto";

export const HUBSPOT_MCP_AUTHORIZE_URL =
  "https://mcp.hubspot.com/oauth/authorize/user";
export const HUBSPOT_MCP_TOKEN_URL = "https://mcp.hubspot.com/oauth/v3/token";
export const HUBSPOT_MCP_SERVER_URL =
  process.env.HUBSPOT_MCP_SERVER_URL?.trim() || "https://mcp.hubspot.com";

const base64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** RFC 7636 code_verifier: 43-128 chars from the unreserved set. */
export function generateCodeVerifier(): string {
  // 32 random bytes -> 43 base64url chars
  return base64url(crypto.randomBytes(32));
}

/** RFC 7636 S256 challenge: base64url(SHA256(verifier)). */
export function deriveCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

// ---------------------------------------------------------------------------
// Config loader + token persistence helpers (Task 4)
// ---------------------------------------------------------------------------

import { prisma } from "./prisma";
import { encryptSecret } from "./integrationsCrypto";

export interface HubSpotMcpProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function resolveHubSpotMcpRedirectUri(): string {
  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com";
  return `${baseUrl}/settings/providers/hubspot/mcp/callback`;
}

export async function loadHubSpotMcpProviderConfig(): Promise<HubSpotMcpProviderConfig> {
  const provider = await prisma.workspaceProviderConnection.findUnique({
    where: { providerKey: "hubspot_mcp" },
  });
  if (!provider) {
    throw new Error("HubSpot MCP app is not configured");
  }
  return {
    clientId: provider.defaultModel?.trim() ?? "",
    clientSecret: provider.apiKey?.trim() ?? "",
    redirectUri: resolveHubSpotMcpRedirectUri(),
  };
}

export interface HubSpotMcpTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  message?: string;
}

export interface HubSpotMcpConnectionContext {
  portalId: string;
  hubDomain?: string | null;
  displayName?: string | null;
  connectedEmail?: string | null;
  connectedName?: string | null;
}

/** Build the encrypted, expiring record fields from a token response. */
export function mapTokenResponseToConnection(
  body: HubSpotMcpTokenResponse,
  ctx: HubSpotMcpConnectionContext,
  now: number = Date.now(),
) {
  if (!body.access_token) {
    throw new Error("HubSpot MCP token response missing access_token");
  }
  return {
    portalId: ctx.portalId,
    hubDomain: ctx.hubDomain ?? null,
    displayName: ctx.displayName ?? null,
    connectedEmail: ctx.connectedEmail ?? null,
    connectedName: ctx.connectedName ?? null,
    connected: true,
    accessToken: encryptSecret(body.access_token),
    refreshToken: body.refresh_token ? encryptSecret(body.refresh_token) : null,
    tokenType: body.token_type ?? "bearer",
    tokenExpiresAt:
      typeof body.expires_in === "number"
        ? new Date(now + body.expires_in * 1000)
        : null,
    installedAt: new Date(now),
    lastRefreshAt: new Date(now),
    lastError: null,
  };
}
