# HubSpot Unified Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One "Connect HubSpot" action on a project connects BOTH HubSpot grants — REST OAuth (buildout) then MCP (agentic) — in a single user flow, and the project panel shows both connection statuses. Web-layer only; no changes to the protected REST OAuth backend.

**Architecture:** The chaining lives entirely in the existing REST OAuth callback component. The unified button sets a sessionStorage flag carrying the projectId, starts REST OAuth, and on the REST callback the component (if the flag is set) immediately launches the MCP start for the just-connected portal (`portal.id`, the HubSpot record id used as the MCP connection key) and redirects into the MCP consent. The MCP callback returns to the project.

**Tech Stack:** Next.js 14 (apps/web), TypeScript, Tailwind.

**Decision record:** `docs/superpowers/specs/2026-06-24-hubspot-auth-connect-model-decision.md`

**Key facts (verified):**
- REST start: `POST /api/hubspot/oauth/start` body `{ projectId, clientId?, installProfile:"core_crm", returnTo:"/projects/{id}" }` → `{ authUrl }`.
- REST callback component `apps/web/app/components/HubSpotOAuthCallback.tsx` POSTs `/api/hubspot/oauth/callback` and gets `{ portal: { id, portalId, connected, displayName, hubDomain, ... }, returnTo }`. `portal.id` is the HubSpotPortal **record id**.
- MCP start: `POST /api/hubspot/mcp/oauth/start` body `{ portalId, projectId? }` → `{ authUrl }`. The `portalId` it expects is the **record id** (`portal.id`), consistent with `HubSpotMcpConnection.portalId`, `project.portalId`, and `ProjectHubSpotAccessPanel.portalRecordId`.
- MCP status: `GET /api/hubspot/mcp/connection/{recordId}` → `{ connected, hubDomain, ... }`.
- Panel `ProjectHubSpotAccessPanel` props: `{ projectId, connectionReady (REST connected bool), portalRecordId, hubDomain, hubTier }`; it already renders `<HubSpotMcpConnectCard portalId={portalRecordId} projectId={projectId} />`.

---

### Task 1: Chain MCP after REST in the OAuth callback component

**Files:**
- Modify: `apps/web/app/components/HubSpotOAuthCallback.tsx`

- [ ] **Step 1: Add chained-MCP handling**

Read the file first. After the existing successful `/api/hubspot/oauth/callback` POST (where `body.portal` and `body.returnTo` are available), insert chaining BEFORE the existing `router.replace(body.returnTo)`:

```tsx
// Chained MCP connect: if the unified "Connect HubSpot" flow set this flag,
// continue into the MCP grant for the just-connected portal before returning.
let chainRaw: string | null = null;
try {
  chainRaw = window.sessionStorage.getItem("hubspot-chain-mcp");
} catch {
  chainRaw = null;
}
if (chainRaw && body?.portal?.id) {
  try {
    window.sessionStorage.removeItem("hubspot-chain-mcp");
  } catch {
    // ignore
  }
  let chainProjectId: string | undefined;
  try {
    chainProjectId = JSON.parse(chainRaw)?.projectId;
  } catch {
    chainProjectId = undefined;
  }
  try {
    const mcpResponse = await fetch("/api/hubspot/mcp/oauth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalId: body.portal.id, projectId: chainProjectId }),
    });
    const mcpBody = await mcpResponse.json().catch(() => null);
    if (mcpResponse.ok && mcpBody?.authUrl) {
      window.location.href = mcpBody.authUrl;
      return;
    }
    // MCP start failed — fall through to the normal REST returnTo with a note.
  } catch {
    // network error — fall through to normal REST completion
  }
}
```

Place this so it runs only on the success path (after `if (!response.ok) throw ...`), and the existing `router.replace(...)` / `router.refresh()` remain as the fallback when not chaining or if MCP start fails. Keep the existing `sessionStorage` "hubspot-oauth-feedback" behavior intact for the non-chained path.

- [ ] **Step 2: Typecheck**

Run: `cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 / no new errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/HubSpotOAuthCallback.tsx
git commit -m "feat(hubspot): chain MCP connect after REST OAuth in callback"
```

---

### Task 2: Unified "Connect HubSpot" button + combined status panel

**Files:**
- Modify: `apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx`
- Create: `apps/web/app/components/HubSpotUnifiedConnectButton.tsx`

- [ ] **Step 1: Create the unified connect button**

Create `apps/web/app/components/HubSpotUnifiedConnectButton.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function HubSpotUnifiedConnectButton({
  projectId,
  clientId,
  label = "Connect HubSpot",
}: {
  projectId: string;
  clientId?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      // Flag the REST callback to chain into the MCP grant.
      try {
        window.sessionStorage.setItem(
          "hubspot-chain-mcp",
          JSON.stringify({ projectId }),
        );
      } catch {
        // sessionStorage unavailable — REST still connects, MCP can be added from its card
      }
      const r = await fetch("/api/hubspot/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientId,
          installProfile: "core_crm",
          returnTo: `/projects/${projectId}`,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed to start HubSpot connect");
      window.location.href = body.authUrl;
    } catch (e) {
      try {
        window.sessionStorage.removeItem("hubspot-chain-mcp");
      } catch {
        // ignore
      }
      alert(e instanceof Error ? e.message : "Failed to connect HubSpot");
      setBusy(false);
    }
  };

  return (
    <button
      onClick={connect}
      disabled={busy}
      className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink-0 disabled:opacity-60"
    >
      {busy ? "Connecting…" : label}
    </button>
  );
}
```

Match the real Tailwind token for a primary button used elsewhere in the panel/card (the MCP card used `bg-white ... text-ink-0`). If those tokens differ in this panel, match the panel's primary-button style.

- [ ] **Step 2: Surface it in the panel as a combined connect/status**

Read `ProjectHubSpotAccessPanel.tsx`. The panel already shows REST status via `connectionReady` and renders `HubSpotMcpConnectCard`. Update so:
- When `connectionReady` is FALSE (REST not connected): show the unified `HubSpotUnifiedConnectButton` (one click connects REST then MCP). Pass `projectId={props.projectId}` and, if the panel has access to the client id, `clientId`.
- When `connectionReady` is TRUE: keep showing REST "Connected" status, and keep the existing `HubSpotMcpConnectCard` so the user can connect/disconnect the MCP grant independently (covers portals where REST is already connected but MCP isn't).

Concretely, add the import:
```tsx
import HubSpotUnifiedConnectButton from "../../HubSpotUnifiedConnectButton";
```
and render the unified button in the not-connected branch. Do not remove the existing REST status display or the MCP card. Keep changes minimal and within the panel's existing layout.

- [ ] **Step 3: Typecheck**

Run: `cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 / no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/HubSpotUnifiedConnectButton.tsx apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx
git commit -m "feat(hubspot): unified Connect HubSpot button + combined status in project panel"
```

---

### Task 3: Verify build + full typecheck

**Files:** none (verification)

- [ ] **Step 1: Typecheck both apps**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api && cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 for both.

- [ ] **Step 2: Sanity-check the chain logic by reading the two files together**

Confirm: the unified button sets `hubspot-chain-mcp` with `{projectId}`; the REST callback reads it, clears it, and POSTs `/api/hubspot/mcp/oauth/start` with `portalId: body.portal.id` (record id) + the carried `projectId`, then redirects to the MCP authUrl. No leftover flag on the non-chained path.

- [ ] **Step 3 (no code change needed): done.**

---

## Notes / out of scope

- **Token-preference flip is NOT in this build** (deferred per decision doc). `resolveHubSpotWriteToken` is untouched.
- **Cosmetic:** `HubSpotMcpConnection.portalId` stores the HubSpotPortal **record id**, not the hub_id, despite the field name. It is internally consistent end-to-end and works; renaming is deferred (would need a migration + data move). Do not change it here.
- **Reports/dashboards** still require the separate browser-session capture; unchanged.
- Manual verification after merge: on a project with no portal, click "Connect HubSpot" → REST consent → automatically MCP consent → land back on the project with both connected. On a project with REST already connected, the MCP card alone connects the agent grant.
