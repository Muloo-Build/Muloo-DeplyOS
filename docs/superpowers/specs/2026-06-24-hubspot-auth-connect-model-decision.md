# HubSpot Auth & Connect Model — Capability Audit + Decision

**Date:** 2026-06-24
**Status:** Decision recorded — implementation pending approval
**Context:** Deploy OS is Muloo's internal delivery portal for clients and projects.
Three (really four) HubSpot auth mechanisms now coexist; this records what each is
for and the chosen connect model.

## The four HubSpot access paths (as built today)

| # | Path | Store | Multi-portal | Used by |
|---|------|-------|--------------|---------|
| A | **Private-app token** | `PortalSession.privateAppToken` (per-portal, browser-captured) + `WorkspaceHubSpotPrivateApp` (singleton) | per-portal via session | `propertyApply`, `portalAudit` write client (preferred first by `resolveHubSpotWriteToken`) |
| B | **REST OAuth** (`hubspot_oauth`) | `HubSpotPortal.accessToken/refreshToken` | yes | `HubSpotClient`/`HubSpotWriteClient` against `api.hubapi.com`; custom objects; audit snapshot |
| C | **MCP** (`hubspot_mcp`) | `HubSpotMcpConnection` | yes | `mcpAgent` via Anthropic MCP connector → `mcp.hubspot.com` |
| D | **Browser-session CSRF** | `PortalSession.csrfToken` + `baseUrl` | per-portal via session | `dashboardBuild`, `reportInstall` (no REST API for reports/dashboards) |

## Capability → required auth (audited from code)

| Capability | Auth that works | Notes |
|---|---|---|
| Contact/CRM properties (create/update) | A, B, C(safe) | `HubSpotWriteClient.createProperty` etc. |
| Pipelines + stages | A, B, C(safe) | MCP delete/archive denylisted |
| Workflows (create) | A, B, C | audit read via B |
| Contact lists | A, C | `createList` |
| **Custom object schemas** | **B only** | `createCustomObjectSchema` → `POST /crm/v3/schemas`; **MCP cannot** |
| **Marketing content** (blog/email/campaign create) | **A only** | `HubSpotWriteClient` CMS/marketing endpoints; MCP read-only, no OAuth path today |
| **Dashboards / reports** | **D only** | no public REST API; browser session required |
| Portal snapshot / audit (users, teams, schemas, lists) | **B** | scope-gated reads |
| Deals/quotes (read + safe write) | A, B, C | quote sync uses A today |
| Open-ended agentic CRM record + engagement work | **C** | the MCP investment |

**Conclusion: no single auth covers delivery.** OAuth (B) is the structured-buildout
backbone; MCP (C) is the additive agentic layer; browser-session (D) is unavoidable
for reports; private-app (A) overlaps B for clients and is being reserved for
Muloo's own portal.

## Decision

1. **Client portals connect via a single "Connect HubSpot" action that performs
   REST OAuth (B) then MCP (C) in sequence**, storing both grants. A connected
   portal is delivery-ready for structured *and* agentic work; the client sees one
   connect (two HubSpot consent screens, clearly labelled).

2. **Private-app (A) is reserved for Muloo's own portal only.** Client-portal
   structured writes must use OAuth (B). This requires flipping the preference in
   `resolveHubSpotWriteToken` so that, for client portals, OAuth (B) is used and the
   per-portal `PortalSession.privateAppToken` is not the default write path.
   (Muloo's own portal may still use A.)

3. **Browser-session capture (D)** remains a separate, occasional step, surfaced
   only when a project's scope includes dashboards/reports. It cannot be OAuth.

4. **Marketing-content creation** stays on the private-app write client for now
   (no OAuth/MCP path exists). Flag in projects where marketing builds are scoped;
   revisit if HubSpot adds OAuth/MCP coverage.

## Implementation outline (for the follow-on plan)

- **Unified connect endpoint/flow:** a "Connect HubSpot" action that starts OAuth (B),
  and on successful callback chains into the MCP (C) start, returning to the project.
  Reuse the existing `createHubSpotOAuthStart`/`completeHubSpotOAuthCallback` (B) and
  `createHubSpotMcpOAuthStart`/`completeHubSpotMcpOAuthCallback` (C). Carry a
  `chainTo: "mcp"` flag in the B-callback's returnTo so the web layer auto-launches
  the C-start.
- **Connect status surface:** one card showing both B and C status per portal
  (REST: connected/scopes; Agent(MCP): connected). Replace/extend
  `HubSpotMcpConnectCard` + the existing REST connect UI into a single panel.
- **Token preference flip:** in `resolveHubSpotWriteToken`, gate the
  `PortalSession.privateAppToken` preference to Muloo's own portal; client portals
  resolve OAuth (B) first.
- **Reports affordance:** keep the browser-session capture path; label it as required
  only when reports/dashboards are in scope.
- **Tests:** chained-connect state carry; token-preference gating (Muloo portal → A,
  client portal → B); status surface for both grants.

## Open confirmations

- Which portal id / flag marks "Muloo's own portal" (for the A-vs-B gating)? Need a
  reliable signal (env var with Muloo's hub id, or a `Client.isInternal` flag).
- Exact MCP destructive tool names (already tracked in the prior hardening task).
