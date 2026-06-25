import crypto from "node:crypto";

export const HUBSPOT_MCP_AUTHORIZE_URL =
  "https://mcp.hubspot.com/oauth/authorize/user";
export const HUBSPOT_MCP_TOKEN_URL = "https://mcp.hubspot.com/oauth/v3/token";
export const HUBSPOT_MCP_SERVER_URL =
  process.env.HUBSPOT_MCP_SERVER_URL?.trim() || "https://mcp.hubspot.com";
/**
 * Token-introspection endpoint for MCP-issued tokens (RFC 7662 style POST).
 * Returns hub_domain / user / scopes. Overridable for tests or if HubSpot
 * relocates the endpoint. CONFIRM against a live MCP token once available.
 */
export const HUBSPOT_MCP_INTROSPECT_URL =
  process.env.HUBSPOT_MCP_INTROSPECT_URL?.trim() ||
  "https://mcp.hubspot.com/oauth/v3/token/introspect";

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
  scopes?: string[];
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
    scopes: ctx.scopes ?? [],
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

export interface HubSpotMcpTokenInfo {
  hubId?: string | null;
  hubDomain?: string | null;
  connectedEmail?: string | null;
  connectedName?: string | null;
  scopes: string[];
}

/**
 * Introspect an MCP access token to recover hub/user metadata.
 * Mirrors the REST flow's fetchHubSpotOAuthAccessTokenInfo, but against the
 * MCP token's introspection endpoint (the MCP token is not valid against the
 * standard api.hubapi.com /oauth/v1/access-tokens endpoint).
 */
export async function fetchHubSpotMcpTokenInfo(
  accessToken: string,
): Promise<HubSpotMcpTokenInfo> {
  const response = await fetch(HUBSPOT_MCP_INTROSPECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ token: accessToken }).toString(),
  });
  const body = (await response.json().catch(() => null)) as {
    active?: boolean;
    hub_id?: number | string;
    hub_domain?: string;
    user?: string;
    user_name?: string;
    name?: string;
    scopes?: string[];
    scope?: string;
  } | null;
  if (!response.ok || !body || body.active === false) {
    throw new Error("Failed to introspect HubSpot MCP token");
  }
  const scopes = Array.isArray(body.scopes)
    ? body.scopes
    : typeof body.scope === "string"
      ? body.scope.split(/\s+/).filter(Boolean)
      : [];
  return {
    hubId: body.hub_id != null ? String(body.hub_id) : null,
    hubDomain: body.hub_domain ?? null,
    connectedEmail: body.user ?? null,
    connectedName: body.user_name ?? body.name ?? null,
    scopes,
  };
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

  // Populate hub/user metadata from the MCP token. Non-fatal: a failed
  // introspection must not block the connect — metadata backfills on refresh.
  let tokenInfo: HubSpotMcpTokenInfo = { scopes: [] };
  try {
    tokenInfo = await fetchHubSpotMcpTokenInfo(tokenBody.access_token!);
  } catch (error) {
    console.warn(
      "HubSpot MCP token introspection failed:",
      error instanceof Error ? error.message : error,
    );
  }

  const record = mapTokenResponseToConnection(tokenBody, {
    portalId,
    hubDomain: tokenInfo.hubDomain ?? null,
    displayName: tokenInfo.hubDomain ?? null,
    connectedEmail: tokenInfo.connectedEmail ?? null,
    connectedName: tokenInfo.connectedName ?? null,
    scopes: tokenInfo.scopes,
  });
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

// ---------------------------------------------------------------------------
// Destructive-tool denylist (Task 10)
// ---------------------------------------------------------------------------

/**
 * Curated always-disable list. CONFIRMED against the live HubSpot MCP catalog
 * (2026-06, portal 8066413): the server exposes get_user_details,
 * search_crm_objects, get_crm_objects, manage_crm_objects, query_crm_data,
 * search_properties, get_properties, search_owners, get_organization_details,
 * manage_landing_page, render_landing_page_ui, get_content_analytics_report,
 * get_campaign_*, submit_feedback, tool_guidance. There is NO standalone
 * delete/archive/bulk-delete tool — writes funnel through manage_crm_objects
 * (create/update). So this list is a forward-compatible safety net for
 * destructive tools HubSpot may add later. The dynamic gate below is the real
 * enforcement: it lists the live catalog and disables anything destructive,
 * so we never silently fail to gate a tool whose exact name we didn't predict.
 *
 * v1 LIMITATION: manage_crm_objects is the single write surface. If HubSpot
 * ever adds a delete *operation* inside it (vs. a separate delete tool), a
 * name-based gate cannot block it without disabling all writes — revisit then.
 */
export const HUBSPOT_MCP_DESTRUCTIVE_TOOLS = [
  "delete_crm_objects",
  "delete_crm_object",
  "archive_crm_objects",
  "batch_delete_crm_objects",
  "delete_properties",
  "delete_property",
  "delete_pipeline",
  "merge_crm_objects",
] as const;

/**
 * Matches tool names whose verb implies irreversible data loss. Word-boundary
 * anchored so safe names like manage_crm_objects / get_crm_objects pass.
 */
export const HUBSPOT_MCP_DESTRUCTIVE_PATTERN =
  /(^|[_-])(delete|destroy|archive|purge|remove|merge|wipe|truncate|drop)([_-]|$)/i;

export function isDestructiveHubSpotMcpTool(name: string): boolean {
  return HUBSPOT_MCP_DESTRUCTIVE_PATTERN.test(name);
}

// ---------------------------------------------------------------------------
// Minimal MCP streamable-HTTP client — just enough to list the live catalog.
// ---------------------------------------------------------------------------

const MCP_PROTOCOL_VERSION = "2025-06-18";

function parseJsonRpcPayloads(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return [JSON.parse(trimmed)];
    } catch {
      return [];
    }
  }
  // Server-sent-events framing: collect each `data:` line's JSON payload.
  const out: any[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const m = line.match(/^data:\s*(.+)$/);
    if (m?.[1]) {
      try {
        out.push(JSON.parse(m[1]));
      } catch {
        /* ignore non-JSON keepalive frames */
      }
    }
  }
  return out;
}

/** List every tool name the live HubSpot MCP server exposes for this token. */
export async function listHubSpotMcpToolNames(token: string): Promise<string[]> {
  const headersBase: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    Authorization: `Bearer ${token}`,
  };

  const initRes = await fetch(HUBSPOT_MCP_SERVER_URL, {
    method: "POST",
    headers: headersBase,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "muloo-deployos", version: "1.0.0" },
      },
    }),
  });
  if (!initRes.ok) {
    throw new Error(`MCP initialize failed: ${initRes.status}`);
  }
  const sessionId = initRes.headers.get("mcp-session-id") ?? undefined;
  const sessionHeaders = sessionId
    ? { ...headersBase, "Mcp-Session-Id": sessionId }
    : headersBase;

  // Drain the initialize body (some transports require the stream consumed).
  await initRes.text().catch(() => "");

  // Required handshake notification before any subsequent request.
  await fetch(HUBSPOT_MCP_SERVER_URL, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);

  const names: string[] = [];
  let cursor: string | undefined;
  let id = 2;
  do {
    const res = await fetch(HUBSPOT_MCP_SERVER_URL, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: id++,
        method: "tools/list",
        params: cursor ? { cursor } : {},
      }),
    });
    if (!res.ok) {
      throw new Error(`MCP tools/list failed: ${res.status}`);
    }
    const text = await res.text();
    const result = parseJsonRpcPayloads(text)
      .map((p) => p?.result)
      .find((r) => r && Array.isArray(r.tools));
    if (!result) break;
    for (const tool of result.tools as Array<{ name?: string }>) {
      if (typeof tool?.name === "string") names.push(tool.name);
    }
    cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
  } while (cursor);

  return names;
}

/**
 * Build mcp_toolset.configs that disables destructive tools.
 *
 * Always disables the curated denylist. When a token is supplied, additionally
 * lists the live catalog and disables every tool matching the destructive
 * pattern — so newly-added or renamed destructive tools are caught without a
 * code change. If live listing fails, the curated denylist still applies.
 */
export async function buildHubSpotMcpToolsetConfigs(opts?: {
  token?: string;
}): Promise<Record<string, { enabled: false }>> {
  const disabled = new Set<string>(HUBSPOT_MCP_DESTRUCTIVE_TOOLS);

  if (opts?.token) {
    try {
      for (const name of await listHubSpotMcpToolNames(opts.token)) {
        if (isDestructiveHubSpotMcpTool(name)) disabled.add(name);
      }
    } catch (error) {
      console.warn(
        "HubSpot MCP tool enumeration failed; using curated denylist only:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return Object.fromEntries(
    [...disabled].map((name) => [name, { enabled: false as const }]),
  );
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
