# HubSpot MCP Agentic Delivery — Design

**Date:** 2026-06-24
**Status:** Approved (design) — pending spec review
**Branch:** `feat/hubspot-mcp-agentic-delivery`

## Goal

Let Muloo's AI agents deliver client work directly inside client HubSpot
portals. We have created a HubSpot **MCP Auth App** (`Muloo Deploy`, App ID
`43676388`) that uses OAuth 2.1 + PKCE against HubSpot's remote MCP server.
This design wires that app into the platform so that:

1. Multiple client portals can authorize the app (multi-tenant), and
2. Our agents connect to each portal's HubSpot MCP server and use HubSpot's
   tool catalog to do delivery work, scoped per portal.

This is **additive**. The existing REST OAuth integration (`app.hubspot.com`
public app → `HubSpotWriteClient` → `api.hubapi.com`) stays as-is for
structured two-way sync. MCP is a new, agent-native delivery channel.

## Why MCP connector (not a self-hosted MCP client)

The Anthropic Messages API has a native remote-MCP connector
(beta `mcp-client-2025-11-20`). We pass HubSpot's MCP server URL plus the
portal's OAuth access token as `authorization_token`; Claude discovers and
calls the HubSpot tools server-side and runs the tool loop. We do **not** build
an MCP client or a manual tool loop. This is the smallest viable build and maps
the per-portal OAuth token we already need straight onto `authorization_token`.

Confirmed connector shape (verified against platform docs, 2026-06-24):

```jsonc
// client.beta.messages.create(...)
{
  "model": "claude-opus-4-8",
  "max_tokens": 8192,
  "thinking": { "type": "adaptive" },
  "betas": ["mcp-client-2025-11-20"],
  "mcp_servers": [
    { "type": "url", "url": HUBSPOT_MCP_URL, "name": "hubspot",
      "authorization_token": "<portal MCP access token>" }
  ],
  "tools": [
    { "type": "mcp_toolset", "mcp_server_name": "hubspot",
      "configs": { /* destructive tools disabled — see Guardrails */ } }
  ]
}
```

Response carries `mcp_tool_use` / `mcp_tool_result` content blocks. `stop_reason`
may be `pause_turn` (server-side tool loop hit its iteration limit — re-send to
continue) or `refusal`.

> **Data retention:** the MCP connector is **not** ZDR-eligible. Tool
> definitions and results are retained per Anthropic's standard policy. This
> must be documented for client-data governance before go-live.

## External facts (verified 2026-06-24)

| Thing | Value |
|---|---|
| HubSpot authorize URL | `https://mcp.hubspot.com/oauth/authorize/user` |
| HubSpot token URL | `https://mcp.hubspot.com/oauth/v3/token` |
| HubSpot MCP server URL | `mcp.hubspot.com` — exact streamable-HTTP path **to confirm at plan time** |
| Auth | OAuth 2.1 + PKCE (S256), verifier 43–128 chars; client_id + client_secret + refresh tokens |
| Redirect (this app) | `https://deploy.wearemuloo.com/settings/providers/hubspot/mcp/callback` (must be added to the app's Redirect URLs) |
| Anthropic beta header | `mcp-client-2025-11-20` |

## Decisions

- **Granularity: per-portal.** One HubSpot account = one MCP authorization.
  Linked to clients through the existing `Client.hubSpotPortalId` relation.
- **Tool gating (v1): read + safe writes allowed, hard-destructive denied.**
  The platform goal is for agents to *deliver*, so read-only defeats the
  purpose. Allow create/update of properties, pipelines, lists, content.
  Denylist destructive operations (bulk delete, delete object types/pipelines).
  Audit every `mcp_tool_use`.
- **Storage is separate from the REST integration.** New `HubSpotMcpConnection`
  model; existing `HubSpotPortal` (REST tokens) is left untouched. This keeps
  the protected portal-connect logic isolated.

## Architecture

Two sub-projects, built in order.

### Sub-project 1 — MCP connect flow (per-portal OAuth 2.1 + PKCE)

**Data model** (new):

```prisma
model HubSpotMcpConnection {
  id              String    @id @default(cuid())
  portalId        String    @unique          // HubSpot hub id
  displayName     String?
  hubDomain       String?
  connected       Boolean   @default(false)
  accessToken     String?                     // encrypted at rest
  refreshToken    String?                     // encrypted at rest
  tokenType       String?
  tokenExpiresAt  DateTime?
  scopes          String[]  @default([])
  connectedEmail  String?
  connectedName   String?
  installedAt     DateTime?
  lastRefreshAt   DateTime?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

`Client` already carries `hubSpotPortalId`; MCP connection is resolved by the
same portal id, so no `Client` schema change is required.

**App credentials:** stored as a new `WorkspaceProviderConnection` row with
`providerKey = "hubspot_mcp"` (`defaultModel` = client_id, `apiKey` =
client_secret), reusing the existing provider-connection pattern that
`hubspot_oauth` already uses. A loader `loadHubSpotMcpProviderConfig()` returns
`{ clientId, clientSecret, authorizeUrl, tokenUrl, mcpServerUrl, redirectUri }`.

**PKCE without a new table:** the `code_verifier` is stored inside an encrypted,
signed `state` token (same approach as the existing `createHubSpotOAuthStart`,
which already signs context into `state`). Only the S256 `code_challenge` is
sent to HubSpot. State carries `{ codeVerifier, portalContext, returnTo, exp }`
with a 10-minute expiry.

**Flow & endpoints:**

1. `POST /api/hubspot/mcp/oauth/start`
   - Generate `code_verifier` (43–128 chars, CSPRNG), derive S256
     `code_challenge`.
   - Sign+encrypt state carrying the verifier + context.
   - Build authorize URL:
     `https://mcp.hubspot.com/oauth/authorize/user?client_id=…&redirect_uri=…/settings/providers/hubspot/mcp/callback&code_challenge=…&code_challenge_method=S256&state=…`
   - Return `{ authUrl }`.
2. New web route `/settings/providers/hubspot/mcp/callback` — receives
   `code`, `state`, `error`; posts to the backend.
3. `POST /api/hubspot/mcp/oauth/callback`
   - Verify + decrypt state, extract `code_verifier`.
   - Exchange at `https://mcp.hubspot.com/oauth/v3/token` with
     `grant_type=authorization_code`, `client_id`, `client_secret`,
     `redirect_uri`, `code`, `code_verifier`.
   - Resolve hub id / domain / email, upsert `HubSpotMcpConnection`, mark
     `connected = true`.
4. `resolveHubSpotMcpToken(portalId)` — return a valid access token; refresh
   when within 60s of expiry via `grant_type=refresh_token`; on refresh failure
   set `connected = false` + `lastError`, and surface "needs reauth". Mirrors
   the existing `refreshHubSpotPortalAccessTokenIfNeeded` in
   `apps/api/src/queue/processors/resolveHubSpotWriteToken.ts`.

**UI:**
- Integrations page (`apps/web/app/settings/integrations/page.tsx`): add a
  "HubSpot Agentic (MCP)" card → its own settings page (connect/disconnect,
  status, last refresh, scopes).
- Per-client/project: a "Connect AI agent (MCP)" action + connection status,
  reusing the existing connect-card pattern
  (`ProjectHubSpotAccessPanel` / `ClientHubSpotInviteCard`).
- Disconnect endpoint `DELETE /api/hubspot/mcp/connection/:portalId`.

### Sub-project 2 — MCP agentic execution

**Dependency:** add `@anthropic-ai/sdk` to `apps/api`.

**New queue module `mcp_agent`** — processor
`apps/api/src/queue/processors/mcpAgent.ts`:
- Build the Anthropic client; API key via the existing
  `envApiKeyFor("anthropic")` / provider-connection resolution in
  `apps/api/src/aiRoutingExtras.ts`.
- Resolve the portal token: `resolveHubSpotMcpToken(payload.portalId)`.
- Call `client.beta.messages.create` with the connector shape above:
  `model: "claude-opus-4-8"`, `thinking: { type: "adaptive" }`,
  `betas: ["mcp-client-2025-11-20"]`, the single `hubspot` server, and the
  gated `mcp_toolset`.
- Loop on `stop_reason === "pause_turn"` (re-send to continue server-side tool
  loop), bounded by a max-continuations cap (e.g. 10). Stop on `end_turn`;
  handle `refusal`.
- Extract `mcp_tool_use` / `mcp_tool_result` blocks → write an audit trail into
  the execution job output. Log token usage via the existing
  `logAIUsageEvent` (`agentKey: "mcp_agent"`).

**Job wiring:**
- Add `mcp_agent` to `apps/api/src/queue/jobRouter.ts`.
- Job payload: `{ executionJobId, portalId, projectId, task, toolAllowlist? }`.
- Worker (`apps/api/src/queue/worker.ts`) needs no change — it already routes by
  `moduleKey` and persists status/output.
- Job-creation endpoint to enqueue an `mcp_agent` job for a connected portal.

**Trigger surface (UI):** a "Run agent" action on a connected project that takes
a task prompt and enqueues the job; status tracked like existing execution jobs.

## Guardrails (protected areas)

This adds a **parallel** model and a new agentic channel. It does **not** modify
commercial logic, quote gating, retainer/invoice models, or the existing portal
approval/connect flow. Specific controls:

- **Tool gating** — `mcp_toolset.configs` disables hard-destructive HubSpot
  tools by default (bulk delete, delete object types/pipelines). The exact tool
  names are enumerated at plan time from HubSpot's MCP tool catalog.
- **Per-portal scoping** — an agent run only ever attaches the token for the one
  `portalId` in its payload. No cross-portal access.
- **Audit** — every `mcp_tool_use` (name + input + result/error) is persisted to
  the execution-job output for review.
- **Data retention** — document the non-ZDR caveat of the MCP connector for
  client-data governance before enabling for live client portals.
- **Secrets** — `accessToken`/`refreshToken` and `client_secret` encrypted at
  rest (reuse the encryption already used for `WorkspaceHubSpotPrivateApp`).

## Error handling

| Condition | Handling |
|---|---|
| Access token expiring (<60s) | Refresh via `refresh_token` before the call |
| Refresh fails | `connected = false`, `lastError` set, UI shows "Reconnect" |
| `mcp_tool_result.is_error` | Surface in job output; agent may retry/adjust |
| `stop_reason: "pause_turn"` | Re-send to continue; cap continuations |
| `stop_reason: "refusal"` | Record refusal; do not retry verbatim |
| Token endpoint / network error | Job fails with a clear message; retryable |

## Testing

Mirror the existing `tests/*.mjs` Node test style:
- PKCE: `code_challenge` S256 derivation from a known verifier.
- State token: encrypt/sign → decrypt/verify round-trip; expiry rejection.
- Token serialization: `HubSpotMcpConnection` upsert from a mock token response.
- Tool gating: the `mcp_toolset.configs` denylist is applied for the destructive
  tool set.
- Routing: `mcp_agent` resolves in `jobRouter`.
- Processor (integration): mock the HubSpot token endpoint and the Anthropic
  Messages API; assert the request carries the right server URL + token and that
  `pause_turn` continuation + audit extraction work.

## Open items to confirm at plan time

1. Exact HubSpot MCP **server URL path** for `mcp_servers[].url`.
2. Exact HubSpot MCP **tool names** to denylist (destructive set).
3. Whether HubSpot's token endpoint expects the client secret via HTTP Basic or
   POST body alongside PKCE (confidential client + PKCE).
4. Encryption helper to reuse for the new token fields.

## Out of scope (v1)

- Human-in-the-loop approval gates per tool call (future; connector supports
  denylist now, interactive approval would be a later enhancement).
- Multi-server agent runs (only the HubSpot server for v1).
- Migrating or replacing the existing REST OAuth integration.
