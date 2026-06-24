# HubSpot MCP Agentic Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Muloo's AI agents deliver work inside client HubSpot portals via the HubSpot remote MCP server, authorized per-portal with OAuth 2.1 + PKCE and driven through the Anthropic Messages API MCP connector.

**Architecture:** Sub-project 1 adds a per-portal MCP OAuth connect flow (new `HubSpotMcpConnection` model, PKCE, token storage/refresh, connect UI), isolated from the existing REST `HubSpotPortal` integration. Sub-project 2 adds an `mcp_agent` BullMQ processor that calls `client.beta.messages.create` with HubSpot's MCP server attached, gated to deny destructive tools.

**Tech Stack:** Hono (apps/api), Next.js 14 (apps/web), Prisma/Postgres, BullMQ, `@anthropic-ai/sdk`, node:test.

**Spec:** `docs/superpowers/specs/2026-06-24-hubspot-mcp-agentic-delivery-design.md`

---

## File Structure

**New (apps/api):**
- `apps/api/src/hubspotMcpOAuth.ts` — PKCE helpers, `hubspot_mcp` config loader, authorize-URL builder, token exchange, refresh, `resolveHubSpotMcpToken`, start/callback orchestration.
- `apps/api/src/queue/processors/mcpAgent.ts` — the agentic processor.
- `apps/api/prisma/migrations/<ts>_add_hubspot_mcp_connection/migration.sql` — generated.

**New (apps/web):**
- `apps/web/app/settings/providers/hubspot/mcp/callback/page.tsx`
- `apps/web/app/components/HubSpotMcpOAuthCallback.tsx`
- `apps/web/app/components/HubSpotMcpConnectCard.tsx`
- `apps/web/app/settings/integrations/hubspot-mcp/page.tsx`

**New (tests):**
- `tests/hubspot-mcp-pkce.test.mjs`
- `tests/hubspot-mcp-oauth.test.mjs`
- `tests/mcp-agent-routing.test.mjs`

**Modified:**
- `apps/api/prisma/schema.prisma` — add `HubSpotMcpConnection`.
- `apps/api/src/server.ts` — `export` `createSignedStateToken` + `verifySignedStateToken`.
- `apps/api/src/app.ts` — register MCP routes; import handlers.
- `apps/api/src/queue/jobRouter.ts` — add `mcp_agent` route.
- `apps/api/package.json` — add `@anthropic-ai/sdk`.
- `apps/web/app/settings/integrations/page.tsx` — add MCP card.
- `apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx` — surface connect + run-agent action.

**Constants (defined in `hubspotMcpOAuth.ts`):**
```ts
export const HUBSPOT_MCP_AUTHORIZE_URL = "https://mcp.hubspot.com/oauth/authorize/user";
export const HUBSPOT_MCP_TOKEN_URL = "https://mcp.hubspot.com/oauth/v3/token";
// CONFIRM exact streamable-HTTP path at first integration run; default below:
export const HUBSPOT_MCP_SERVER_URL = process.env.HUBSPOT_MCP_SERVER_URL?.trim() || "https://mcp.hubspot.com";
```
> Plan-time open item: confirm `HUBSPOT_MCP_SERVER_URL` against HubSpot docs / a live install before enabling for real portals. It is overridable by env so confirmation does not block earlier tasks.

---

# Sub-project 1 — MCP connect flow

### Task 1: Add Prisma model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via CLI

- [ ] **Step 1: Add the model**

Append to `apps/api/prisma/schema.prisma`:

```prisma
model HubSpotMcpConnection {
  id             String    @id @default(cuid())
  portalId       String    @unique
  displayName    String?
  hubDomain      String?
  connected      Boolean   @default(false)
  accessToken    String?
  refreshToken   String?
  tokenType      String?
  tokenExpiresAt DateTime?
  scopes         String[]  @default([])
  connectedEmail String?
  connectedName  String?
  installedAt    DateTime?
  lastRefreshAt  DateTime?
  lastError      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

> `accessToken` / `refreshToken` hold ciphertext from `encryptSecret` — stored as plain `String?`, encrypted at the application layer (Task 4).

- [ ] **Step 2: Generate the migration**

Run: `cd "apps/api" && npx prisma migrate dev --name add_hubspot_mcp_connection`
Expected: a new folder under `apps/api/prisma/migrations/` and `Prisma schema loaded` + `migration applied`.

- [ ] **Step 3: Generate client**

Run: `cd "apps/api" && npx prisma generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(mcp): add HubSpotMcpConnection model + migration"
```

---

### Task 2: Export state-token helpers from server.ts

**Files:**
- Modify: `apps/api/src/server.ts:4517`

- [ ] **Step 1: Add `export` to both helpers**

Find `function createSignedStateToken(` and `function verifySignedStateToken(` (~line 4517) and prefix each with `export`:

```ts
export function createSignedStateToken(value: Record<string, unknown>) {
```
```ts
export function verifySignedStateToken(value: string) {
```

- [ ] **Step 2: Typecheck**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "refactor(oauth): export signed-state-token helpers for reuse"
```

---

### Task 3: PKCE helpers (pure functions) + tests

**Files:**
- Create: `apps/api/src/hubspotMcpOAuth.ts`
- Test: `tests/hubspot-mcp-pkce.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/hubspot-mcp-pkce.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

const { generateCodeVerifier, deriveCodeChallenge } = await import(
  "../apps/api/dist/hubspotMcpOAuth.js"
);

test("generateCodeVerifier returns a 43-128 char URL-safe string", () => {
  const v = generateCodeVerifier();
  assert.ok(v.length >= 43 && v.length <= 128, `length ${v.length}`);
  assert.match(v, /^[A-Za-z0-9\-._~]+$/);
});

test("deriveCodeChallenge matches the known RFC 7636 S256 vector", () => {
  // RFC 7636 Appendix B
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = deriveCodeChallenge(verifier);
  assert.strictEqual(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
```

- [ ] **Step 2: Write the module with PKCE helpers**

Create `apps/api/src/hubspotMcpOAuth.ts`:

```ts
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
```

- [ ] **Step 3: Build then run the test to verify it passes**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api && node --test tests/hubspot-mcp-pkce.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/hubspotMcpOAuth.ts tests/hubspot-mcp-pkce.test.mjs
git commit -m "feat(mcp): PKCE verifier/challenge helpers"
```

---

### Task 4: Config loader + token persistence helpers + tests

**Files:**
- Modify: `apps/api/src/hubspotMcpOAuth.ts`
- Test: `tests/hubspot-mcp-oauth.test.mjs`

- [ ] **Step 1: Write the failing test (token-response → upsert mapping)**

Create `tests/hubspot-mcp-oauth.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

const { mapTokenResponseToConnection } = await import(
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
```

- [ ] **Step 2: Add the config loader + mapping to the module**

Append to `apps/api/src/hubspotMcpOAuth.ts`:

```ts
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
```

- [ ] **Step 3: Build then run the test to verify it passes**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api && node --test tests/hubspot-mcp-oauth.test.mjs`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/hubspotMcpOAuth.ts tests/hubspot-mcp-oauth.test.mjs
git commit -m "feat(mcp): hubspot_mcp config loader + token-response mapping"
```

---

### Task 5: Token exchange, refresh, and `resolveHubSpotMcpToken`

**Files:**
- Modify: `apps/api/src/hubspotMcpOAuth.ts`

- [ ] **Step 1: Add code exchange + refresh + resolve**

Append to `apps/api/src/hubspotMcpOAuth.ts`:

```ts
import { decryptSecret } from "./integrationsCrypto";

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
  // CONFIRM at plan time: HubSpot may want the secret via HTTP Basic instead of
  // the body. Body form below is the default; PKCE verifier is always sent.
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
```

- [ ] **Step 2: Typecheck**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/hubspotMcpOAuth.ts
git commit -m "feat(mcp): token exchange, refresh, and resolveHubSpotMcpToken"
```

---

### Task 6: Start + callback orchestration

**Files:**
- Modify: `apps/api/src/hubspotMcpOAuth.ts`

- [ ] **Step 1: Add start + callback functions**

Append to `apps/api/src/hubspotMcpOAuth.ts`:

```ts
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
  await prisma.hubSpotMcpConnection.upsert({
    where: { portalId },
    create: record,
    update: record,
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
```

> Note: `verified` is typed `Record<string, unknown>` (the helper's return) — the `String(...)` / `typeof` guards above narrow it safely.

- [ ] **Step 2: Typecheck**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/hubspotMcpOAuth.ts
git commit -m "feat(mcp): OAuth start/callback/disconnect/status orchestration"
```

---

### Task 7: Register Hono routes

**Files:**
- Modify: `apps/api/src/app.ts` (schemas near line 751; routes near line 8359)

- [ ] **Step 1: Add imports**

In the `from "./hubspotMcpOAuth"` import (add a new import block near the other server imports in `apps/api/src/app.ts`):

```ts
import {
  createHubSpotMcpOAuthStart,
  completeHubSpotMcpOAuthCallback,
  disconnectHubSpotMcp,
  getHubSpotMcpConnectionStatus,
} from "./hubspotMcpOAuth";
```

- [ ] **Step 2: Add zod schemas (near the existing `hubSpotOAuthStartSchema`)**

```ts
const hubSpotMcpStartSchema = z
  .object({
    portalId: z.string(),
    projectId: z.string().optional(),
    returnTo: z.string().optional(),
  })
  .passthrough();

const hubSpotMcpCallbackSchema = z
  .object({ code: z.string().optional(), state: z.string().optional() })
  .passthrough();
```

- [ ] **Step 3: Add routes (after the existing `/api/hubspot/oauth/callback` route)**

```ts
app.post("/api/hubspot/mcp/oauth/start", async (c) => {
  const body = hubSpotMcpStartSchema.parse(await readJsonBodyOrEmpty(c));
  try {
    return c.json(await createHubSpotMcpOAuthStart(body));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to start HubSpot MCP OAuth" },
      400,
    );
  }
});

app.post("/api/hubspot/mcp/oauth/callback", async (c) => {
  const body = hubSpotMcpCallbackSchema.parse(await readJsonBodyOrEmpty(c));
  try {
    return c.json(await completeHubSpotMcpOAuthCallback(body));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to complete HubSpot MCP OAuth" },
      400,
    );
  }
});

app.get("/api/hubspot/mcp/connection/:portalId", async (c) => {
  return c.json(await getHubSpotMcpConnectionStatus(c.req.param("portalId")));
});

app.delete("/api/hubspot/mcp/connection/:portalId", async (c) => {
  return c.json(await disconnectHubSpotMcp(c.req.param("portalId")));
});
```

- [ ] **Step 4: Typecheck**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(mcp): register HubSpot MCP OAuth + connection routes"
```

---

### Task 8: Web callback route + component

**Files:**
- Create: `apps/web/app/settings/providers/hubspot/mcp/callback/page.tsx`
- Create: `apps/web/app/components/HubSpotMcpOAuthCallback.tsx`

- [ ] **Step 1: Create the callback component**

Create `apps/web/app/components/HubSpotMcpOAuthCallback.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HubSpotMcpOAuthCallback({
  code,
  state,
  error,
}: {
  code?: string;
  state?: string;
  error?: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("Connecting HubSpot MCP…");

  useEffect(() => {
    async function complete() {
      if (error) {
        setFailed(true);
        setMessage(`HubSpot returned an error: ${error}`);
        return;
      }
      if (!code || !state) {
        setFailed(true);
        setMessage("The HubSpot MCP callback is missing code or state.");
        return;
      }
      try {
        const response = await fetch("/api/hubspot/mcp/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to complete HubSpot MCP OAuth");
        }
        router.replace(body.returnTo ?? "/settings/integrations/hubspot-mcp");
        router.refresh();
      } catch (callbackError) {
        setFailed(true);
        setMessage(callbackError instanceof Error ? callbackError.message : "Failed");
      }
    }
    void complete();
  }, [code, error, router, state]);

  return (
    <div className="min-h-screen bg-ink-0 px-6 py-24 text-center text-white">
      <p className={failed ? "text-red-400" : "text-white"}>{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `apps/web/app/settings/providers/hubspot/mcp/callback/page.tsx`:

```tsx
import HubSpotMcpOAuthCallback from "../../../../../components/HubSpotMcpOAuthCallback";

export default function SettingsProvidersHubSpotMcpCallbackPage({
  searchParams,
}: {
  searchParams?: { code?: string; state?: string; error?: string };
}) {
  return (
    <HubSpotMcpOAuthCallback
      code={searchParams?.code}
      state={searchParams?.state}
      error={searchParams?.error}
    />
  );
}
```

> Verify the relative depth of the `components` import by matching the sibling file `apps/web/app/settings/providers/hubspot/callback/page.tsx` (one directory deeper here, so one extra `../`).

- [ ] **Step 3: Typecheck web**

Run: `cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 (or no new errors versus baseline).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/settings/providers/hubspot/mcp/callback/page.tsx apps/web/app/components/HubSpotMcpOAuthCallback.tsx
git commit -m "feat(mcp): web OAuth callback route + component"
```

---

### Task 9: Connect card + integrations + project surfaces

**Files:**
- Create: `apps/web/app/components/HubSpotMcpConnectCard.tsx`
- Create: `apps/web/app/settings/integrations/hubspot-mcp/page.tsx`
- Modify: `apps/web/app/settings/integrations/page.tsx`
- Modify: `apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx`

- [ ] **Step 1: Create the connect card**

Create `apps/web/app/components/HubSpotMcpConnectCard.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

interface Status {
  portalId: string;
  connected: boolean;
  hubDomain?: string | null;
  connectedEmail?: string | null;
  lastError?: string | null;
}

export default function HubSpotMcpConnectCard({
  portalId,
  projectId,
}: {
  portalId: string;
  projectId?: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/hubspot/mcp/connection/${portalId}`);
    setStatus(await r.json().catch(() => null));
  }, [portalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/hubspot/mcp/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalId, projectId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed to start");
      window.location.href = body.authUrl;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to connect");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await fetch(`/api/hubspot/mcp/connection/${portalId}`, { method: "DELETE" });
    await load();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-1 p-4">
      <h3 className="text-sm font-semibold text-white">HubSpot Agentic (MCP)</h3>
      <p className="mt-1 text-xs text-white/60">
        Authorize Muloo agents to deliver work in this HubSpot portal.
      </p>
      {status?.connected ? (
        <div className="mt-3 text-xs text-green-400">
          Connected{status.hubDomain ? ` — ${status.hubDomain}` : ""}
          <button onClick={disconnect} disabled={busy} className="ml-3 text-white/50 underline">
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={busy}
          className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink-0"
        >
          Connect AI agent
        </button>
      )}
      {status?.lastError ? (
        <p className="mt-2 text-xs text-red-400">{status.lastError}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create the MCP settings page**

Create `apps/web/app/settings/integrations/hubspot-mcp/page.tsx`:

```tsx
export default function HubSpotMcpSettingsPage() {
  return (
    <div className="px-6 py-8 text-white">
      <h1 className="text-lg font-semibold">HubSpot Agentic (MCP)</h1>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        Connect each client HubSpot portal so Muloo agents can deliver work via
        HubSpot&apos;s MCP server. Connect per portal from the project workspace.
        Note: agent activity through the MCP connector is not covered by Anthropic
        zero-data-retention.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Add a card to the integrations landing page**

In `apps/web/app/settings/integrations/page.tsx`, add a card entry to the existing grid (mirror the HubSpot card's shape) linking to `/settings/integrations/hubspot-mcp` with title "HubSpot Agentic (MCP)" and description "Let Muloo agents deliver work inside connected client portals via HubSpot's MCP server." Match the existing card markup exactly.

- [ ] **Step 4: Surface the connect card in the project panel**

In `apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx`, import and render `HubSpotMcpConnectCard` when a `portalRecordId`/portal id is present:

```tsx
import HubSpotMcpConnectCard from "../../HubSpotMcpConnectCard";
// ...inside the rendered output, where props expose the portal id:
{props.portalId ? (
  <HubSpotMcpConnectCard portalId={props.portalId} projectId={props.projectId} />
) : null}
```

> Match the actual prop name this panel uses for the HubSpot portal id (it may be `portalRecordId` or `hubSpotPortalId` — read the panel's props first and use the existing one).

- [ ] **Step 5: Typecheck web**

Run: `cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 / no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/HubSpotMcpConnectCard.tsx apps/web/app/settings/integrations/hubspot-mcp/page.tsx apps/web/app/settings/integrations/page.tsx apps/web/app/components/project/panels/ProjectHubSpotAccessPanel.tsx
git commit -m "feat(mcp): connect card, settings page, and project/integrations surfaces"
```

---

### Task 9b: Seed script for the `hubspot_mcp` credential row

**Files:**
- Create: `scripts/seed-hubspot-mcp.mjs`
- Modify: `package.json` (add a `seed:hubspot-mcp` script)

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-hubspot-mcp.mjs`:

```javascript
// Upserts the workspaceProviderConnection row used by the HubSpot MCP OAuth flow.
// Run once per environment:
//   HUBSPOT_MCP_CLIENT_ID=... HUBSPOT_MCP_CLIENT_SECRET=... pnpm seed:hubspot-mcp
import { PrismaClient } from "@prisma/client";

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
```

> Confirm `WorkspaceProviderConnection` exposes `isEnabled` (the existing
> `hubspot_oauth` loader reads `provider.isEnabled`); drop the field from
> create/update if the model has no such column.

- [ ] **Step 2: Add the package script**

In root `package.json` scripts, add:

```json
"seed:hubspot-mcp": "cd apps/api && node ../../scripts/seed-hubspot-mcp.mjs"
```

> Mirror the working-directory convention of the existing `db:migrate` script
> (it `cd apps/api` first so Prisma resolves the schema/client).

- [ ] **Step 3: Verify it runs (dry check against a local/staging DB)**

Run: `HUBSPOT_MCP_CLIENT_ID=test-id HUBSPOT_MCP_CLIENT_SECRET=test-secret pnpm seed:hubspot-mcp`
Expected: `Seeded hubspot_mcp provider connection (<id>).` Re-running updates the same row (idempotent).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-hubspot-mcp.mjs package.json
git commit -m "feat(mcp): seed script for hubspot_mcp provider credentials"
```

> **Production run:** in Railway, set `HUBSPOT_MCP_CLIENT_ID` =
> `97e466ab-d6c5-4cfe-bbd5-9f2c65f6a9d7` and `HUBSPOT_MCP_CLIENT_SECRET` =
> (the app's Client secret), then run `pnpm seed:hubspot-mcp` once. These two
> env vars are only needed at seed time; the values live in the DB row after.

---

# Sub-project 2 — MCP agentic execution

### Task 10: Add the Anthropic SDK + tool-gating config

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/hubspotMcpOAuth.ts` (export the denylist)

- [ ] **Step 1: Install the SDK**

Run: `cd "apps/api" && pnpm add @anthropic-ai/sdk`
Expected: `@anthropic-ai/sdk` appears in `apps/api/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Export the destructive-tool denylist**

Append to `apps/api/src/hubspotMcpOAuth.ts`:

```ts
/**
 * HubSpot MCP tool names disabled by default (hard-destructive).
 * CONFIRM against HubSpot's live MCP tool catalog at plan time and extend.
 */
export const HUBSPOT_MCP_DESTRUCTIVE_TOOLS = [
  "delete_object",
  "batch_delete_objects",
  "delete_pipeline",
  "delete_property",
  "archive_object",
] as const;

/** mcp_toolset.configs that disables each destructive tool. */
export function buildHubSpotMcpToolsetConfigs(): Record<string, { enabled: false }> {
  return Object.fromEntries(
    HUBSPOT_MCP_DESTRUCTIVE_TOOLS.map((name) => [name, { enabled: false as const }]),
  );
}
```

- [ ] **Step 3: Build**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/hubspotMcpOAuth.ts
git commit -m "feat(mcp): add @anthropic-ai/sdk + destructive-tool denylist"
```

---

### Task 11: The `mcp_agent` processor

**Files:**
- Create: `apps/api/src/queue/processors/mcpAgent.ts`

- [ ] **Step 1: Write the processor**

Create `apps/api/src/queue/processors/mcpAgent.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { logAIUsageEvent } from "../../aiUsage";
import type { JobPayload, JobResult } from "../jobRouter";
import {
  HUBSPOT_MCP_SERVER_URL,
  buildHubSpotMcpToolsetConfigs,
  resolveHubSpotMcpToken,
} from "../../hubspotMcpOAuth";

const MODEL = "claude-opus-4-8";
const MCP_BETA = "mcp-client-2025-11-20";
const MAX_CONTINUATIONS = 10;

interface McpAgentPayload {
  portalId: string;
  projectId?: string;
  task: string;
}

interface McpToolAction {
  name: string;
  serverName?: string;
  input: unknown;
  isError?: boolean;
}

export async function runMcpAgent(data: JobPayload): Promise<JobResult> {
  const payload = (data.payload ?? {}) as Partial<McpAgentPayload>;
  const portalId = payload.portalId ?? data.portalId;
  if (!portalId || !payload.task) {
    throw new Error("portalId and task are required for mcp_agent");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const token = await resolveHubSpotMcpToken(portalId);
  const client = new Anthropic({ apiKey });
  const startedAt = Date.now();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: payload.task },
  ];
  const actions: McpToolAction[] = [];
  const textOut: string[] = [];
  let lastUsage: Anthropic.Beta.BetaUsage | undefined;
  let errored = false;
  let errorMessage: string | null = null;

  try {
    for (let i = 0; i < MAX_CONTINUATIONS; i += 1) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        betas: [MCP_BETA],
        messages,
        mcp_servers: [
          {
            type: "url",
            url: HUBSPOT_MCP_SERVER_URL,
            name: "hubspot",
            authorization_token: token,
          },
        ],
        tools: [
          {
            type: "mcp_toolset",
            mcp_server_name: "hubspot",
            configs: buildHubSpotMcpToolsetConfigs(),
          },
        ],
      });

      lastUsage = response.usage;

      for (const block of response.content) {
        if (block.type === "text") {
          textOut.push(block.text);
        } else if (block.type === "mcp_tool_use") {
          actions.push({
            name: block.name,
            serverName: block.server_name,
            input: block.input,
          });
        } else if (block.type === "mcp_tool_result") {
          const last = actions[actions.length - 1];
          if (last) last.isError = block.is_error ?? false;
        }
      }

      if (response.stop_reason === "refusal") {
        errored = true;
        errorMessage = "Agent refused the task";
        break;
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      // end_turn or any terminal reason
      break;
    }
  } catch (error) {
    errored = true;
    errorMessage = error instanceof Error ? error.message : "mcp_agent failed";
  }

  logAIUsageEvent({
    providerKey: "anthropic",
    model: MODEL,
    tokens: {
      promptTokens: lastUsage?.input_tokens ?? 0,
      completionTokens: lastUsage?.output_tokens ?? 0,
    },
    latencyMs: Date.now() - startedAt,
    agentKey: "mcp_agent",
    projectId: payload.projectId ?? null,
    errored,
    errorMessage,
  });

  return {
    success: !errored,
    dryRun: data.dryRun ?? false,
    output: {
      status: errored ? "error" : "complete",
      summary: textOut.join("\n").slice(0, 4000),
      actions,
      errorMessage,
    },
  };
}
```

> `tokens` shape: confirm `UsageInputTokens` field names against `apps/api/src/aiUsage.ts` (`extractUsage` shows the expected keys); adjust `promptTokens`/`completionTokens` if the interface differs.

- [ ] **Step 2: Build**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api`
Expected: exit 0. If the Anthropic SDK types reject `mcp_servers`/`betas` on `beta.messages.create`, confirm the installed SDK version exposes the `mcp-client-2025-11-20` shape and adjust to the installed types (the field names are stable per the connector docs).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/queue/processors/mcpAgent.ts
git commit -m "feat(mcp): mcp_agent processor via Anthropic MCP connector"
```

---

### Task 12: Wire into the job router + tests

**Files:**
- Modify: `apps/api/src/queue/jobRouter.ts`
- Test: `tests/mcp-agent-routing.test.mjs`

- [ ] **Step 1: Write the failing routing test**

Create `tests/mcp-agent-routing.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Add the route**

In `apps/api/src/queue/jobRouter.ts`, add the import and case:

```ts
import { runMcpAgent } from './processors/mcpAgent';
```
```ts
    case 'mcp_agent':
      return runMcpAgent(data);
```

- [ ] **Step 3: Build then run the test**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api && node --test tests/mcp-agent-routing.test.mjs`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/queue/jobRouter.ts tests/mcp-agent-routing.test.mjs
git commit -m "feat(mcp): route mcp_agent jobs + tool-gating test"
```

---

### Task 13: Job-creation endpoint + run-agent UI

**Files:**
- Modify: `apps/api/src/server.ts` (add `startMcpAgentJob`)
- Modify: `apps/api/src/app.ts` (route)
- Modify: `apps/web/app/components/HubSpotMcpConnectCard.tsx` (run action)

- [ ] **Step 1: Add the job creator in server.ts**

Add near `startProjectPortalAuditExecutionJob` in `apps/api/src/server.ts`:

```ts
export async function startMcpAgentJob(input: {
  projectId: string;
  task: string;
}) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, portalId: true },
  });
  if (!project) throw new Error("Project not found");
  if (!project.portalId) throw new Error("No portal connected to this project");

  const job = await prisma.executionJob.create({
    data: {
      projectId: project.id,
      jobType: "mcp_agent",
      moduleKey: "mcp_agent",
      executionMethod: "agent",
      mode: "async",
      status: "queued",
      resultStatus: "pending",
      outputSummary: "Queued MCP delivery agent.",
      payload: {
        projectId: project.id,
        portalId: project.portalId,
        task: input.task,
      },
    },
    include: { project: { select: { name: true } } },
  });

  await executionQueue.add(
    job.moduleKey,
    {
      executionJobId: job.id,
      moduleKey: job.moduleKey,
      projectId: project.id,
      portalId: project.portalId,
      dryRun: false,
      payload: job.payload,
    },
    { jobId: job.id },
  );

  return serializeExecutionJob(job);
}
```

- [ ] **Step 2: Add the route in app.ts**

```ts
const mcpAgentRunSchema = z
  .object({ projectId: z.string(), task: z.string().min(1) })
  .passthrough();

app.post("/api/hubspot/mcp/agent/run", async (c) => {
  const body = mcpAgentRunSchema.parse(await readJsonBodyOrEmpty(c));
  try {
    return c.json(await startMcpAgentJob(body));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to start agent" },
      400,
    );
  }
});
```

Add `startMcpAgentJob` to the existing `from "./server"` import block.

- [ ] **Step 3: Add a run action to the connect card**

In `apps/web/app/components/HubSpotMcpConnectCard.tsx`, when connected and a `projectId` is present, render a minimal task input + "Run agent" button that POSTs `{ projectId, task }` to `/api/hubspot/mcp/agent/run`:

```tsx
{status?.connected && projectId ? (
  <RunAgent projectId={projectId} />
) : null}
```

And add the component at the bottom of the file:

```tsx
function RunAgent({ projectId }: { projectId: string }) {
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/hubspot/mcp/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, task }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed");
      setMsg("Agent queued.");
      setTask("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Describe the delivery task for the agent…"
        className="w-full rounded-lg border border-white/10 bg-ink-0 p-2 text-xs text-white"
      />
      <button
        onClick={run}
        disabled={busy || !task.trim()}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink-0"
      >
        Run agent
      </button>
      {msg ? <p className="text-xs text-white/60">{msg}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck both apps**

Run: `node "node_modules/typescript/lib/tsc.js" -b apps/api && cd "apps/web" && npx tsc --noEmit`
Expected: exit 0 / no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/app.ts apps/web/app/components/HubSpotMcpConnectCard.tsx
git commit -m "feat(mcp): run-agent job endpoint + UI trigger"
```

---

### Task 14: Full build + test sweep

**Files:** none (verification)

- [ ] **Step 1: Run the full project test command**

Run: `pnpm test`
Expected: TypeScript build passes; existing tests plus the 3 new `hubspot-mcp-*` / `mcp-agent-*` tests pass.

- [ ] **Step 2: Document the env/config requirements**

Append to `.env.example`:

```
# HubSpot MCP Auth App (OAuth 2.1 + PKCE). Stored in DB as a
# workspaceProviderConnection row providerKey="hubspot_mcp"
# (defaultModel=client_id, apiKey=client_secret). Optionally override the
# MCP server URL here once confirmed against HubSpot docs:
HUBSPOT_MCP_SERVER_URL=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(mcp): document HubSpot MCP env/config requirements"
```

---

## Plan-time confirmations (resolve during execution, do not block early tasks)

1. **Exact HubSpot MCP server URL** for `mcp_servers[].url` (Task 11; default overridable via `HUBSPOT_MCP_SERVER_URL`).
2. **Exact destructive tool names** from HubSpot's MCP catalog (Task 10 `HUBSPOT_MCP_DESTRUCTIVE_TOOLS`).
3. **client_secret transport** at the token endpoint — HTTP Basic vs body (Task 5 `exchangeMcpAuthorizationCode`).
4. **`hubspot_mcp` provider row** must be seeded with the app's `client_id`/`client_secret` (App ID 43676388) before the connect flow works — via the existing provider-connections admin UI/route used for `hubspot_oauth`.
5. **Anthropic usage `tokens` shape** — confirm `UsageInputTokens` field names in `apps/api/src/aiUsage.ts` (Task 11).
6. **`@anthropic-ai/sdk` MCP types** — confirm the installed version types `mcp_servers` + `betas` on `beta.messages.create` (Task 11).
7. **Add `…/settings/providers/hubspot/mcp/callback` to the MCP app's Redirect URLs** in HubSpot before live testing.

## Manual verification (after execution)

- Seed `hubspot_mcp` creds → open a project with a connected portal → "Connect AI agent" → authorize on HubSpot → redirected back, status shows Connected.
- "Run agent" with a safe read task ("list the deal pipelines") → execution job completes, output lists `mcp_tool_use` actions, no destructive tool available.
- Confirm a destructive request is refused/unavailable (denylist holds).
