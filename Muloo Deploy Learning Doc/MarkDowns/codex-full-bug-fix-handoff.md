# Muloo DeployOS — Full Stack Overview + Bug Fix Handoff
*For Codex / Replit review. Read this top to bottom before touching any code.*

---

## What this app is

**Muloo DeployOS** is an internal delivery orchestration platform for Muloo — a HubSpot implementation consultancy. It manages client projects end-to-end, from discovery through to delivery, and uses AI agents to automate HubSpot configuration work on behalf of clients.

There are **two user-facing surfaces**:

1. **Internal platform** (`/`) — Used by Jarrud (owner) and the Muloo team. Manages projects, runs AI agents, operates client portals, drafts emails/agendas, audits HubSpot portals.

2. **Client portal** (`/client/*`) — Used by clients. They log in, view their project scope, review quotes, track delivery, complete discovery questionnaires, and submit work requests.

---

## Tech stack

### Monorepo structure (pnpm workspaces)

```
apps/
  api/          — Hono.js API server (Node, TypeScript) on port 3001
  web/          — Next.js 14 App Router frontend on port 3000
  cli/          — CLI tool (unused in production)
packages/
  shared/       — Shared domain types, catalog, API key types
  core/         — Logger, schema, types used across packages
  config/       — Environment variable loading
  executor/     — HubSpot execution modules (dry-run, property apply, etc.)
  hubspot-client/ — HubSpot write client (private app token auth + CSRF browser session)
  browser-session-executor/ — CSRF-cookie-based internal HubSpot API executor
  report-templates/ — 10 pre-built HubSpot marketing report JSON templates
  diff-engine/  — Property + pipeline diff utilities
  file-system/  — Legacy file-based storage (mostly migrated to DB)
```

### API server (apps/api)
- **Framework**: Hono.js served via Node http.createServer
- **ORM**: Prisma + PostgreSQL (Railway hosted)
- **Queue**: BullMQ + ioredis (Redis on Railway)
- **Auth**: JWT cookies — separate auth for workspace users (`/api/auth/*`) and client portal users (`/api/client-auth/*`)
- **AI**: Anthropic Claude API (claude-sonnet-4-6), routed via `WorkspaceAiRouting` table
- **Email**: Nodemailer via `WorkspaceEmailSettings` or Google OAuth connection
- **HubSpot**: OAuth connection per portal stored in `HubSpotPortal`, plus private app token in `PortalSession`

### Web app (apps/web)
- **Framework**: Next.js 14, App Router, TypeScript
- **Styling**: Tailwind CSS with custom Muloo brand tokens (see `tailwind.config.js`)
- **Auth**: `AuthGate` component for internal routes; `ClientAuthGate` for `/client/*` routes
- **API calls**: All proxied via Next.js rewrites from `/api/*` → `http://localhost:3001/api/*`
- **Fonts**: Montserrat via Google Fonts (loaded in globals.css)

### Key environment variables required
```
DATABASE_URL           — PostgreSQL connection string (Railway)
REDIS_URL              — Redis connection string (Railway)
ANTHROPIC_API_KEY      — Claude API key
APP_BASE_URL           — Production URL (https://deploy.wearemuloo.com)
CLIENT_AUTH_SECRET     — JWT secret for client portal sessions
AUTH_SECRET            — JWT secret for workspace sessions
HUBSPOT_PORTAL_ID      — Default HubSpot portal ID (8066413)
NEXT_OUTPUT_MODE       — Set to "standalone" for Railway builds
```

---

## Database models (Prisma schema summary)

| Model | Purpose |
|---|---|
| `Client` | Client companies (Muloo's clients) |
| `ClientContact` | Contacts within a client company |
| `WorkspaceUser` | Internal Muloo team members |
| `Project` | Delivery projects — the core entity |
| `ProjectQuote` | Versioned commercial quotes per project |
| `ProjectMessage` | Messages between Muloo and client |
| `ProjectContext` | Per-project context entries (prep notes, etc.) |
| `Task` | Delivery tasks within a project |
| `ExecutionJob` | Background agent job queue entries |
| `TaskApproval` | Approval records for tasks |
| `AuditLog` | Change audit trail |
| `WorkflowRun` | AI workflow execution records |
| `ClientPortalUser` | Client-side login users |
| `ClientProjectAccess` | Which projects a client user can see |
| `ClientInputSubmission` | Client questionnaire answers |
| `HubSpotPortal` | Connected HubSpot portals (OAuth) |
| `PortalSnapshot` | Point-in-time HubSpot portal stats |
| `PortalSession` | CSRF token + private app token per portal |
| `DiscoverySubmission` | Discovery session data |
| `DiscoverySummary` | AI-generated discovery summary |
| `Blueprint` + `BlueprintTask` | Project implementation plan |
| `Finding` + `Recommendation` | Audit findings and recommendations |
| `WorkRequest` | Client-submitted work/change requests |
| `AgentDefinition` | Registered AI agents |
| `DeliveryTemplate` + `DeliveryTemplateTask` | Reusable delivery task templates |
| `ProductCatalogItem` | Billable service items |

---

## Internal platform — page map

| Route | Component | Status |
|---|---|---|
| `/` | `page.tsx` → `MulooCommandCentre` | ⚠️ Root page wraps in AuthGate again (double wrap) |
| `/command-centre` | `command-centre/page.tsx` → `MulooCommandCentre` | ✅ Built in latest commit (may not be deployed) |
| `/clients` | `clients/page.tsx` → `ClientsWorkspace` | ✅ Working |
| `/clients/[id]` | `clients/[id]/page.tsx` | ✅ Working |
| `/projects` | `projects/page.tsx` → `ProjectsDashboard` | ✅ Working |
| `/projects/new` | `projects/new/page.tsx` | ✅ Working |
| `/projects/portal-ops` | `projects/portal-ops/page.tsx` → `ProjectPortalOps` | ✅ Working |
| `/projects/[id]` | `projects/[id]/page.tsx` → `ProjectOverview` | ⚠️ Loads but may render blank (see bugs) |
| `/projects/[id]/discovery` | Discovery workspace | ✅ Working |
| `/projects/[id]/delivery` | Delivery board | ✅ Working |
| `/projects/[id]/inputs` | Client input management | ✅ Working |
| `/projects/[id]/prepare` | Prepare workspace | ✅ Working |
| `/projects/[id]/quote` | Quote document | ✅ Working |
| `/projects/[id]/proposal` | Proposal document | ✅ Working |
| `/projects/[id]/audit` | Portal audit workspace | ✅ Working |
| `/projects/[id]/changes` | Change management | ✅ Working |
| `/blueprint/[projectId]` | Blueprint workspace | ✅ Working |
| `/runs` | `runs/page.tsx` | ✅ Working (filter tabs done, day grouping missing) |
| `/agents` | `agents/page.tsx` → `AgentStudio` + `HubSpotAgentWorkbench` | ✅ Working |
| `/inbox` | `inbox/page.tsx` → `InternalInbox` + `WorkRequestsInbox` | ✅ Working |
| `/templates` | `templates/page.tsx` → `DeliveryTemplatesStudio` | ✅ Working |
| `/settings/*` | Various settings pages | ✅ Working |
| `/operations` | Redirects to `/runs` | ✅ Working |

---

## Client portal — page map

| Route | Component | Status |
|---|---|---|
| `/client/login` | `client/login/page.tsx` | ❌ 502 on production |
| `/client/activate` | `client/activate/page.tsx` → `ClientActivateForm` | ❌ 502 on production |
| `/client/forgot-password` | `client/forgot-password/page.tsx` | ❌ 502 on production |
| `/client/projects` | `client/projects/page.tsx` → `ClientProjectsDashboard` | ❌ 502 on production |
| `/client/projects/[id]` | `client/projects/[id]/page.tsx` → `ClientProjectWorkspace` | ❌ 502 on production |
| `/client/projects/[id]/quote` | Quote viewer | ❌ 502 on production |
| `/client/projects/[id]/delivery` | Delivery board viewer | ❌ 502 on production |
| `/client/inbox` | `client/inbox/page.tsx` → `ClientInbox` | ❌ 502 on production |
| `/client/request-work` | `client/request-work/page.tsx` | ❌ 502 on production |
| `/client/support` | `client/support/page.tsx` | ❌ 502 on production |

**ALL `/client/*` routes return 502 Bad Gateway on `deploy.wearemuloo.com`.** The internal platform works fine. This is the most urgent bug. Clients cannot be invited until this is resolved.

---

## Known bugs — prioritised

### BUG 1 — CRITICAL: Client portal 502 on all `/client/*` routes
**Symptom**: Every `/client/*` URL returns 502 Bad Gateway (Railway "Application failed to respond").
**Internal platform**: Works fine on the same deployment.
**Likely causes** (check in this order):
1. **Railway build failure on latest commit** — check Railway Deployments tab. If the latest deploy shows red/failed, the old build is running and it has a broken client portal.
2. **Prisma migration pending** — the `PortalSession` migration added `privateAppToken String?`. If this migration hasn't been applied to the production DB, Prisma will throw on startup for routes that touch `PortalSession`. Run: `npx prisma migrate deploy` with the production `DATABASE_URL`.
3. **`packages/hubspot-client` dist not built** — `package.json` has `"main": "dist/index.js"` but Railway may not run the package build step. Change `main` to `src/index.ts` OR ensure Railway runs `pnpm --filter @muloo/hubspot-client build` before starting.
4. **Redis connection crash** — if `REDIS_URL` is not set or Redis is down, the `ioredis` connection in `apps/api/src/queue/index.ts` will throw and crash the API server. The API server crash means Next.js rewrites to `localhost:3001` all 502. Check: does `/api/auth/session` return a response? If not, the API server is the issue.

**Fix steps**:
1. Go to Railway → Deploy OS service → Deployments. Find the most recent failed deploy, read the build logs.
2. Check `REDIS_URL` is set in Railway environment variables.
3. Run `npx prisma migrate deploy` against production DB.
4. In `packages/hubspot-client/package.json`, either change `"main"` to `"src/index.ts"` or ensure build runs in CI.
5. Re-deploy and verify `/client/login` loads.

---

### BUG 2 — HIGH: Command Centre route 404 on production
**Symptom**: `/command-centre` returns 404. The sidebar links to it but the page doesn't exist in the deployed build.
**Cause**: `apps/web/app/command-centre/page.tsx` was added in the latest commit (`23fbac8`) which has not been successfully deployed yet (see Bug 1).
**Fix**: Fix Bug 1 (deploy latest code). The file exists and just needs to deploy.

---

### BUG 3 — HIGH: Root page double-wraps AuthGate
**Symptom**: `apps/web/app/page.tsx` wraps `<AuthGate>` around `<MulooCommandCentre>` but the root layout already has `<AuthGate>`. Double auth check causes flash and possible redirect loop.
**Fix**: Remove the `<AuthGate>` wrapper from `apps/web/app/page.tsx`. It should just be:
```tsx
import MulooCommandCentre from "./components/MulooCommandCentre";
export default function Home() {
  return <MulooCommandCentre />;
}
```

---

### BUG 4 — HIGH: MulooCommandCentre imports AppShell (circular dependency risk)
**Symptom**: `apps/web/app/components/MulooCommandCentre.tsx` line 6 imports `AppShell`. AppShell renders the full sidebar+shell. But the Command Centre IS the page content — it should be rendered inside AppShell, not contain it.
**Cause**: Incorrect component nesting. MulooCommandCentre should be a plain content component, not wrap itself in a shell.
**Fix**: Remove the `AppShell` import and wrapper from `MulooCommandCentre.tsx`. The shell is already provided by the page layout. The Command Centre page should just be the content area (greeting, stat cards, attention list, projects grid, recent runs).

---

### BUG 5 — MEDIUM: Project detail page renders blank
**Symptom**: `/projects/[id]` loads but may render no visible content.
**Cause**: `ProjectOverview.tsx` is 5000+ lines and was heavily restructured in the Sprint 07 redesign. The tab components in `apps/web/app/components/project/tabs/` are stub files (21–32 lines each) that render placeholder text only. They do not contain the actual content.
**Fix**: The 6 tab components need to be populated with the actual content sections moved from `ProjectOverview.tsx`:
- `OverviewTab.tsx` — project status, quick wins, human inputs summary, blueprint status
- `DiscoveryTab.tsx` — discovery sessions, progress, prepare notes
- `PlanTab.tsx` — blueprint, scope, quote/proposal links
- `DeliveryTab.tsx` — open tasks count, delivery board link, change management
- `CommsTab.tsx` — email composer + agenda builder (side by side)
- `PortalTab.tsx` — portal connection, private app token, Portal Ops

---

### BUG 6 — MEDIUM: Execution jobs not processing (BullMQ worker may not start)
**Symptom**: ExecutionJobs are queued but stay at `status: 'queued'` and never complete.
**Cause**: The BullMQ worker in `apps/api/src/queue/worker.ts` needs to be started. Check `apps/api/src/app.ts` — does it call `startWorker()` on startup? If not, no jobs will ever process.
**Also check**: `REDIS_URL` is set. Without Redis, the queue silently fails (queue.add returns null in test mode, but in production with missing Redis it throws).
**Fix**: In `apps/api/src/app.ts` or `apps/api/src/index.ts`, ensure `startWorker()` is called after the server starts. Add guard: only start worker if `REDIS_URL` is set.

---

### BUG 7 — MEDIUM: Runs page shows "Failed to load execution jobs"
**Symptom**: `/runs` renders filter tabs but shows an API error fetching execution jobs.
**Cause**: Either the API endpoint `GET /api/execution-jobs` is returning an error, or the API server is not running (see Bug 1 — Redis crash could take down the whole API).
**Fix**: Verify API server is up and `GET /api/execution-jobs` returns 200. Check it handles empty results gracefully (return `[]` not a 500).

---

### BUG 8 — LOW: Sidebar `Command Centre` link points to `/command-centre` but default root is `/`
**Symptom**: Clicking `Command Centre` in sidebar navigates to `/command-centre`. The root route `/` also shows the command centre. Two routes do the same thing.
**Fix**: Keep `/command-centre` as the canonical route. Make `/` redirect to `/command-centre`:
```tsx
// apps/web/app/page.tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/command-centre");
}
```

---

### BUG 9 — LOW: Portal Ops "Portal Health" shows "Snapshot needed" even for connected portals
**Symptom**: Portal health shows stale/no snapshot even when a portal is connected and a snapshot exists in `PortalSnapshot` table.
**Cause**: The `ProjectPortalOps` component fetches the portal health but may not be fetching the latest `PortalSnapshot` correctly, or the snapshot endpoint is not wired.
**Fix**: Ensure `GET /api/portal-sessions/:portalId/health` or equivalent returns the latest `PortalSnapshot` record for the portal.

---

## Missing features (not bugs, but needed for client invite today)

### Client invite flow — what needs to work
1. Internal user goes to a project → clicks "Add client user" or similar
2. Enters client's email + first name
3. System creates `ClientPortalUser` + `ClientProjectAccess` records
4. Sends invite email with token link to `/client/activate?token=xxx`
5. Client clicks link, sets password, lands on `/client/projects`

**Current state**: The API is fully built (`inviteClientContactToProjects`, `createClientPortalUserForProject`, invite email builder). The UI for inviting from the internal platform exists in `ProjectOverview.tsx` (client users section). **The blocker is Bug 1 — once the 502 is fixed, the flow should work.**

**Before inviting clients, verify**:
- `WorkspaceEmailSettings` is configured (SMTP or Google OAuth) so invite emails actually send
- `APP_BASE_URL` is set to `https://deploy.wearemuloo.com` so invite links point to the right domain
- Test the full flow with a dummy email first

---

## The agent execution system

### How it's meant to work
1. An `ExecutionJob` record is created in the DB with `status: 'queued'`
2. A BullMQ job is added to the `execution-jobs` queue
3. The BullMQ worker picks it up, routes to the correct processor via `jobRouter.ts`
4. Processor runs, updates the `ExecutionJob` record with results
5. If execution requires a browser session (HubSpot CSRF), it uses `BrowserSessionExecutor`
6. If it can't be done programmatically, it sets `executionTier: 3` and creates a `coworkInstruction` for desktop agent pickup

### Job types currently wired in `jobRouter.ts`
- `portal_audit` → `processors/portalAudit.ts`
- `property_apply` → `processors/propertyApply.ts`
- `dashboard_build` → `processors/dashboardBuild.ts`
- `research_agent` → `processors/researchAgent.ts`

### What's working
- Worker exists and handles status transitions ✅
- Job router exists ✅
- `portalAudit` processor — implemented (uses HubSpotWriteClient + Claude analysis) ✅
- `propertyApply` processor — implemented (existence-check + create/update) ✅
- `dashboardBuild` processor — implemented (BrowserSessionExecutor) ✅
- `HubSpotWriteClient` — built in `packages/hubspot-client/src/HubSpotWriteClient.ts` ✅

### What needs fixing for agents to actually work
- Worker must be started on server boot (check Bug 6)
- Redis must be available (`REDIS_URL` env var)
- `PortalSession` must have `privateAppToken` for property/workflow operations
- `PortalSession` must have `csrfToken` + `capturedBy` cookie for dashboard builds

---

## HubSpot connection types

There are **three** separate HubSpot auth methods in use:

| Method | Where stored | Used for | Status |
|---|---|---|---|
| OAuth token | `HubSpotPortal.accessToken` | CRM reads (contacts, deals, properties list) via MCP + executor | ✅ Working |
| CSRF browser session | `PortalSession.csrfToken` | Dashboard/report creation via internal v1 API | ✅ Built, needs session to be captured manually |
| Private app token | `PortalSession.privateAppToken` | Property CRUD, workflow creation, CMS via REST API | ✅ Built, needs token to be added in Portal tab |

---

## AI Assistant Panel
`apps/web/app/components/AIAssistantPanel.tsx` — built in latest commit.
- Floating chat button (bottom-right) that opens a right-side panel
- Context-aware: knows which project/page you're on
- Can answer questions about project state
- Can trigger agent actions (run portal audit, queue dashboard build, generate email draft, navigate)
- Calls `POST /api/assistant` endpoint
**Status**: Built but only deployed if latest commit is live (see Bug 1).

---

## Immediate action list for Hawk

**Do these in order. Don't skip ahead.**

### Step 1 — Fix the Railway deployment (unblocks everything)

1. Open Railway dashboard → Deploy OS service → Deployments tab
2. Find the most recent deploy — is it green or red?
3. If red (failed): read build logs. Most likely cause: `packages/hubspot-client` needs `dist/` built.
   - **Fix**: In `packages/hubspot-client/package.json`, change `"main": "dist/index.js"` to `"main": "src/index.ts"` and `"types": "dist/index.d.ts"` to `"types": "src/index.ts"`. This removes the need for a build step.
   - Commit and push. Railway will redeploy.
4. If green but 502: check Railway runtime logs for errors. Most likely: missing `REDIS_URL` env var OR Prisma migration not applied.
5. Verify `REDIS_URL` is set in Railway environment variables.
6. Run the pending migration: set `DATABASE_URL` to Railway's production DB URL, then run `npx prisma migrate deploy` from `apps/api/`.
7. Redeploy. Verify `/client/login` loads.

### Step 2 — Fix root page double AuthGate (Bug 3)

```tsx
// apps/web/app/page.tsx — replace entire file contents with:
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/command-centre");
}
```

### Step 3 — Fix MulooCommandCentre shell import (Bug 4)

In `apps/web/app/components/MulooCommandCentre.tsx`:
- Remove the import of `AppShell`
- Remove any `<AppShell>` wrapper around the component's return value
- The component should return just the content area markup

### Step 4 — Populate the 6 project tab stubs (Bug 5)

Each tab file in `apps/web/app/components/project/tabs/` is currently a stub.
Open `ProjectOverview.tsx` and identify the sections (search for the collapsible headings).
Move the relevant JSX into each tab:
- `OverviewTab.tsx`: status card, quick wins list, human inputs progress, blueprint status badge
- `DiscoveryTab.tsx`: discovery sessions list, progress bar, prepare notes preview
- `PlanTab.tsx`: blueprint generation/view, scope status, quote/proposal buttons
- `DeliveryTab.tsx`: task counts, delivery board button, change management summary
- `CommsTab.tsx`: email composer + agenda builder side by side (two equal columns)
- `PortalTab.tsx`: portal connection details, private app token input, Portal Ops shortcut

### Step 5 — Confirm worker starts on boot (Bug 6)

In `apps/api/src/app.ts`, search for `startWorker`. If it's not called, add:
```typescript
// At the bottom of createAppServer(), after server setup:
if (process.env.REDIS_URL) {
  const { startWorker } = await import('./queue/worker');
  startWorker();
}
```

### Step 6 — Fix Runs page API error (Bug 7)

Check `GET /api/execution-jobs` handler in `apps/api/src/app.ts`.
Make sure it returns `{ jobs: [] }` when there are no records, not an error.
Add error boundary in the runs page component to show a friendly empty state instead of an error.

### Step 7 — Send test client invite

Once Steps 1-2 are done and the client portal loads:
1. Go to a project in the internal platform
2. Find the client users / invite section
3. Add a test email address
4. Verify the invite email sends and the activate link works
5. Log in as the test client and confirm all pages load

---

## File locations quick reference

```
apps/api/src/app.ts              — All API routes (~4500+ lines)
apps/api/src/server.ts           — Business logic, helper functions (~18000+ lines)
apps/api/src/queue/worker.ts     — BullMQ worker
apps/api/src/queue/jobRouter.ts  — Routes moduleKey to processor
apps/api/prisma/schema.prisma    — Full database schema

apps/web/app/layout.tsx          — Root layout (AuthGate)
apps/web/app/page.tsx            — Root route (should redirect to /command-centre)
apps/web/app/command-centre/page.tsx  — Command Centre page
apps/web/app/components/AppShell.tsx  — Sidebar + AI Assistant wrapper
apps/web/app/components/Sidebar.tsx   — Nav with DELIVERY/OPERATIONS/ADMIN sections
apps/web/app/components/MulooCommandCentre.tsx  — Command Centre content
apps/web/app/components/ProjectOverview.tsx     — Project detail (5000+ lines)
apps/web/app/components/project/              — New tab components (stubs, need populating)
apps/web/app/client/                          — All client portal pages
apps/web/app/components/ClientAuthGate.tsx    — Client portal auth check
apps/web/tailwind.config.js                   — Brand tokens

packages/hubspot-client/src/HubSpotWriteClient.ts  — Write API (properties, workflows, etc.)
packages/hubspot-client/src/hubspotClient.ts        — Read API (OAuth)
packages/browser-session-executor/src/BrowserSessionExecutor.ts  — CSRF dashboard API
packages/report-templates/src/                      — 10 marketing report templates
```

---

## Environment checklist before going live with client invites

| Variable | Where to set | Required for |
|---|---|---|
| `DATABASE_URL` | Railway | Everything |
| `REDIS_URL` | Railway | BullMQ job queue |
| `ANTHROPIC_API_KEY` | Railway | All AI features |
| `APP_BASE_URL` | Railway | Invite email links |
| `AUTH_SECRET` | Railway | Internal login JWT |
| `CLIENT_AUTH_SECRET` | Railway | Client portal JWT |
| `SMTP` settings or Google OAuth | Settings page | Sending invite emails |

---

*Generated: 27 Mar 2026 — for Codex / Replit bug review*
