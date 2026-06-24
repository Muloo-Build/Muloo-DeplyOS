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
import { encryptSecret, decryptSecret } from "./integrationsCrypto";

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

// ---------------------------------------------------------------------------
// Token exchange, refresh, and resolution (Task 5)
// ---------------------------------------------------------------------------

async function postToken(params: Record<string, string>): Promise<HubSpotMcpTokenResponse> {
  const response = await fetch(HUBSPOT_MCP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await response.json().catch(() => null)) as HubSpotMcpTokenResponse | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.message || body?.error || "HubSpot MCP token request failed");
  }
  return body;
}

/** Authorization-code exchange with PKCE. */
export async function exchangeMcpAuthorizationCode(args: {
  code: string;
  codeVerifier: string;
}): Promise<HubSpotMcpTokenResponse> {
  const cfg = await loadHubSpotMcpProviderConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("HubSpot MCP app credentials are incomplete");
  }
  // NOTE: HubSpot may require the secret via HTTP Basic instead of the body.
  // Body form below is the default; the PKCE verifier is always sent.
  return postToken({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code: args.code,
    code_verifier: args.codeVerifier,
  });
}

/** Return a valid access token for a portal, refreshing if within 60s of expiry. */
export async function resolveHubSpotMcpToken(portalId: string): Promise<string> {
  const conn = await prisma.hubSpotMcpConnection.findUnique({ where: { portalId } });
  if (!conn?.connected || !conn.accessToken) {
    throw new Error(`No connected HubSpot MCP authorization for portal ${portalId}`);
  }

  const stillValid =
    conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) {
    return decryptSecret(conn.accessToken);
  }

  if (!conn.refreshToken) {
    throw new Error(`HubSpot MCP token for portal ${portalId} expired and has no refresh token`);
  }

  const cfg = await loadHubSpotMcpProviderConfig();
  try {
    const body = await postToken({
      grant_type: "refresh_token",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      refresh_token: decryptSecret(conn.refreshToken),
    });
    const refreshed = await prisma.hubSpotMcpConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: encryptSecret(body.access_token!),
        refreshToken: body.refresh_token ? encryptSecret(body.refresh_token) : conn.refreshToken,
        tokenType: body.token_type ?? conn.tokenType ?? "bearer",
        tokenExpiresAt:
          typeof body.expires_in === "number"
            ? new Date(Date.now() + body.expires_in * 1000)
            : conn.tokenExpiresAt,
        connected: true,
        lastRefreshAt: new Date(),
        lastError: null,
      },
    });
    return decryptSecret(refreshed.accessToken!);
  } catch (error) {
    await prisma.hubSpotMcpConnection.update({
      where: { id: conn.id },
      data: {
        connected: false,
        lastError: error instanceof Error ? error.message : "refresh failed",
      },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// OAuth start / callback orchestration (Task 6)
// ---------------------------------------------------------------------------

import { createSignedStateToken, verifySignedStateToken } from "./server";

export interface McpOAuthStartInput {
  portalId: string;
  projectId?: string;
  returnTo?: string;
}

export async function createHubSpotMcpOAuthStart(input: McpOAuthStartInput) {
  if (!input.portalId) {
    throw new Error("portalId is required to connect HubSpot MCP");
  }
  const cfg = await loadHubSpotMcpProviderConfig();
  if (!cfg.clientId) {
    throw new Error("HubSpot MCP client_id is not configured");
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);

  const state = createSignedStateToken({
    providerKey: "hubspot_mcp",
    portalId: input.portalId,
    projectId: input.projectId,
    codeVerifier,
    returnTo:
      input.returnTo ??
      (input.projectId ? `/projects/${input.projectId}` : "/settings/integrations/hubspot-mcp"),
    expiresAt: Date.now() + 1000 * 60 * 10,
  });

  const authUrl =
    `${HUBSPOT_MCP_AUTHORIZE_URL}?` +
    new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }).toString();

  return { authUrl };
}

export interface McpOAuthCallbackInput {
  code?: string;
  state?: string;
}

export async function completeHubSpotMcpOAuthCallback(input: McpOAuthCallbackInput) {
  if (!input.code || !input.state) {
    throw new Error("HubSpot MCP callback is missing code or state");
  }
  const verified = verifySignedStateToken(input.state);
  if (verified.providerKey !== "hubspot_mcp") {
    throw new Error("State token is not a HubSpot MCP state");
  }
  if (typeof verified.expiresAt === "number" && verified.expiresAt < Date.now()) {
    throw new Error("HubSpot MCP authorization expired — please retry");
  }
  const codeVerifier = String(verified.codeVerifier ?? "");
  const portalId = String(verified.portalId ?? "");
  if (!codeVerifier || !portalId) {
    throw new Error("HubSpot MCP state is missing PKCE context");
  }

  const tokenBody = await exchangeMcpAuthorizationCode({ code: input.code, codeVerifier });

  const record = mapTokenResponseToConnection(tokenBody, { portalId });
  const { installedAt: _installedAt, ...updatable } = record;
  await prisma.hubSpotMcpConnection.upsert({
    where: { portalId },
    create: record,
    update: updatable,
  });

  return {
    portalId,
    returnTo:
      typeof verified.returnTo === "string"
        ? verified.returnTo
        : "/settings/integrations/hubspot-mcp",
  };
}

export async function disconnectHubSpotMcp(portalId: string) {
  await prisma.hubSpotMcpConnection.updateMany({
    where: { portalId },
    data: { connected: false, accessToken: null, refreshToken: null, lastError: "Disconnected" },
  });
  return { portalId, connected: false };
}

export async function getHubSpotMcpConnectionStatus(portalId: string) {
  const conn = await prisma.hubSpotMcpConnection.findUnique({ where: { portalId } });
  if (!conn) return { portalId, connected: false };
  return {
    portalId,
    connected: conn.connected,
    hubDomain: conn.hubDomain,
    connectedEmail: conn.connectedEmail,
    scopes: conn.scopes,
    tokenExpiresAt: conn.tokenExpiresAt,
    lastError: conn.lastError,
  };
}
