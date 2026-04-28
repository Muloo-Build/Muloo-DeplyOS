# Muloo Deploy OS — Codex Handoff: All Sprints

**Repo:** Muloo-DeplyOS
**Codebase root:** `/path/to/Muloo-DeplyOS` (adjust for your environment)
**Stack:** TypeScript monorepo, pnpm, Hono, Prisma, PostgreSQL, Next.js 14
**Rules that apply to ALL sprints:**
- Run `pnpm build` after every part and fix all TypeScript errors before moving on
- Never modify `.env` — only `.env.example`
- All write operations must respect a `dryRun` flag
- All operations must log to `ExecutionJob`
- No `console.log` in production paths — use structured logging
- Follow existing patterns in the codebase exactly — read the files listed before writing

---

## ✅ Sprint 00 — Portal Ops Execution Layer (COMPLETE)

Already implemented. Includes:
- `packages/browser-session-executor/` — CSRF-cookie authenticated HubSpot internal API
- `packages/report-templates/` — 10 marketing report templates
- `packages/executor/src/agents/marketingDashboardAgent.ts` — scaffolded (needs completion in Sprint 02)
- `PortalSession` Prisma model
- `/api/portal-session` endpoints
- `/api/agents/marketing-dashboard` endpoint
- `/api/report-templates` endpoints
- `CoworkInstruction` types in shared domain

Spec: `docs/sprint-portal-ops-execution-layer.md`

---

## ✅ Sprint 01 — Background Job Worker (COMPLETE)

Already implemented. Includes:
- BullMQ + ioredis wired in
- `apps/api/src/queue/` — index, worker, jobRouter, processors
- `ExecutionJob` status transitions: queued → running → complete/failed
- `GET /api/execution-jobs/:id/status` polling endpoint
- Worker auto-starts on server boot

Spec: `docs/sprint-01-job-worker.md`

**To deploy:** Run `pnpm install`, provision Redis, set `REDIS_URL` env var.

---

## Sprint 02 — Complete Dashboard Agent + HubSpot Write Operations

**Spec file:** `docs/sprint-02-dashboard-agent-completion.md`

---

### Codex Prompt — Sprint 02

```
Implement Sprint 02 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-02-dashboard-agent-completion.md

Before writing any code, read these files:
- packages/executor/src/agents/marketingDashboardAgent.ts
- packages/browser-session-executor/src/BrowserSessionExecutor.ts
- packages/report-templates/src/index.ts
- packages/report-templates/src/TemplateEngine.ts
- packages/hubspot-client/src/hubspotClient.ts
- apps/api/src/queue/processors/dashboardBuild.ts
- packages/shared/src/domain.ts

What to build:

PART 1 — Complete marketingDashboardAgent.ts
The runMarketingDashboardAgent() function body is incomplete (cut off around line 144).
Complete it with the full 6-phase flow from the spec:
  1. Audit: check each template's required properties exist via getPropertyByName()
  2. Determine tier: check PortalSession in DB for the portalId
  3. Plan: build() each buildable template into a ReportDefinition
  4. Execute (tier 2 only): call executor.createReport() for each template
  5. Assemble (tier 2 only): createDashboard() then addReportToDashboard() for each
  6. Handover: return MarketingDashboardOutput with status, dashboardUrl, reportsCreated, manualSteps, summary
If dryRun=true, skip phases 4 and 5 and return status='plan_only'.

PART 2 — Add report/dashboard methods to BrowserSessionExecutor.ts
Add: createReport(reportDef), createDashboard({ name, portalId }), addReportToDashboard(dashboardId, reportId), listDashboards()
All using POST/GET/PUT to /api/reports/v2/ with CSRF headers.
All return ExecutionResult { success, action, data, error, tier: 'browser_session' }.
Never throw — always return success: false with error message on failures.

PART 3 — Add write methods to hubspotClient.ts
Add: createProperty(), updateProperty(), createPipeline(), updatePipelineStage(), updateContactProperty(), searchContacts()
Use the existing @hubspot/api-client instance already in the file.
Follow the exact same error handling pattern as existing methods.

PART 4 — Complete dashboardBuild.ts processor
Replace the stub body with a real call to runMarketingDashboardAgent().
Pass through portalId, projectId, sessionId, dryRun, dashboardName, sectionsToInclude from job payload.

PART 5 — Integration test
Create tests/dashboard-dry-run.test.ts
Test: POST /api/agents/marketing-dashboard with dryRun:true
Poll status until dry_run_complete
Assert outputLog contains plan_only result with ≥1 template

Run pnpm build after each part. Fix all TypeScript errors before proceeding.
Report: all files created/modified, whether build passes, any blockers.
```

---

## Sprint 03 — Cowork Pickup + Perplexity Integration

**Spec file:** `docs/sprint-03-cowork-perplexity-integration.md`

---

### Codex Prompt — Sprint 03

```
Implement Sprint 03 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-03-cowork-perplexity-integration.md

Before writing any code, read these files:
- apps/api/src/app.ts (routing patterns, auth middleware)
- apps/api/prisma/schema.prisma (ExecutionJob model)
- packages/shared/src/domain.ts (existing types)
- apps/api/src/queue/jobRouter.ts (how to add a new processor)
- apps/api/src/queue/index.ts (queue instance)

What to build:

PART 1 — Cowork Instruction Pickup
Add 3 new endpoints to apps/api/src/app.ts:

  GET /api/cowork/pending-instructions
  - Returns ExecutionJob records where status='queued' AND executionTier=3 AND coworkInstruction IS NOT NULL AND coworkSessionId IS NULL
  - Uses Prisma transaction to atomically mark returned jobs as claimed (set coworkSessionId from request body, coworkClaimedAt = now())
  - Query param: ?sessionId=xxx (required, the Cowork session claiming these jobs)

  POST /api/cowork/instructions/:jobId/start
  - Sets ExecutionJob status = 'running', startedAt = now()
  - Returns { ok: true }

  POST /api/cowork/instructions/:jobId/complete
  - Body: { success: boolean, output: string }
  - Sets status = 'complete' or 'failed', completedAt, outputLog or errorLog
  - Returns { ok: true }

Add to Prisma schema (ExecutionJob):
  coworkSessionId  String?
  coworkClaimedAt  DateTime?
Run migration: pnpm prisma migrate dev --name add-cowork-session-fields (from apps/api/)

PART 2 — Perplexity Research Agent
Add 'perplexity' to AIProvider type in packages/shared/src/domain.ts

Create apps/api/src/queue/processors/researchAgent.ts
- Calls Perplexity API: POST https://api.perplexity.ai/chat/completions
- Model: llama-3.1-sonar-large-128k-online
- Auth: Bearer ${process.env.PERPLEXITY_API_KEY}
- Body: { model, messages: [system + user with query], max_tokens: 2000, return_citations: true }
- Returns: { success, dryRun: false, output: { content, citations, query } }

Add 'research' case to apps/api/src/queue/jobRouter.ts pointing to researchAgent processor

Add endpoint to apps/api/src/app.ts:
  POST /api/agents/research
  Body: { query: string, context?: string, projectId?: string }
  Creates ExecutionJob with moduleKey='research', queues it
  Returns: { jobId, status: 'queued' }

Add PERPLEXITY_API_KEY to .env.example

Run pnpm build. Fix all errors.
Report: files created/modified, build status, migration status.
```

---

## Sprint 04 — Task Board + Approval Gates

**Spec file:** `docs/sprint-04-task-board-approval-gates.md`

---

### Codex Prompt — Sprint 04

```
Implement Sprint 04 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-04-task-board-approval-gates.md

Before writing any code, read these files:
- apps/api/src/app.ts (existing task endpoints)
- apps/api/src/server.ts (task-related functions)
- apps/api/prisma/schema.prisma (Task model — check existing fields)
- apps/api/src/queue/index.ts (executionQueue)
- apps/web/app/projects/[id]/delivery/page.tsx (current delivery board page)

What to build:

PART 1 — Task status transition enforcement
Add PATCH /api/projects/:projectId/tasks/:taskId/status to apps/api/src/app.ts
- Enforce valid transitions (spec has the full list)
- If transitioning to 'done' and approvalRequired=true: check TaskApproval model for an approved record, throw 403 if none
- If executionType='api' and status→'in_progress': auto-create ExecutionJob and enqueue it
Add agentModuleKey String? and executionPayload Json? to Task in prisma/schema.prisma
Run migration: pnpm prisma migrate dev --name add-task-execution-fields (from apps/api/)

PART 2 — TaskApproval model + endpoints
Add TaskApproval model to prisma/schema.prisma (spec has full definition)
Run migration: pnpm prisma migrate dev --name add-task-approval
Add 4 endpoints:
  POST /api/projects/:projectId/tasks/:taskId/request-approval
  POST /api/projects/:projectId/tasks/:taskId/approve (internal user only)
  POST /api/projects/:projectId/tasks/:taskId/reject
  GET /api/projects/:projectId/tasks/:taskId/approval

PART 3 — Execute endpoint
Add POST /api/projects/:projectId/tasks/:taskId/execute
Body: { dryRun?: boolean, sessionId?: string }
- Check executionType = 'api' or 'cowork'
- Check executionReadiness != 'not_ready'
- Check approval if approvalRequired
- Create and queue ExecutionJob
- Set task status = 'in_progress'
- Return { jobId, status: 'queued' }

PART 4 — Board endpoint
Add GET /api/projects/:projectId/tasks/board
Returns tasks grouped by status column with latest ExecutionJob status embedded per task

PART 5 — Frontend delivery board
Update apps/web/app/projects/[id]/delivery/page.tsx
- Render task columns (backlog, todo, in_progress, waiting_on_client, blocked, done)
- Status badge showing job status for tasks with active jobs
- "Run" button on tasks where executionType='api' and executionReadiness='ready'|'ready_with_review'
- "Approve" button on tasks with approvalRequired=true and pending approval
- Status change dropdown on each task card
Keep it simple — no drag-and-drop required.

Run pnpm build. Fix all TypeScript and React errors.
Report: files modified, migration status, build status.
```

---

## Sprint 05 — Security Hardening + Data Model Cleanup

**Spec file:** `docs/sprint-05-security-data-model.md`

---

### Codex Prompt — Sprint 05

```
Implement Sprint 05 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-05-security-data-model.md

Before writing any code, read these files:
- apps/api/src/app.ts (find hardcoded credentials and unvalidated endpoints)
- apps/api/src/server.ts (find password handling, login logic)
- apps/api/prisma/schema.prisma (full schema)
- packages/file-system/src/projects.ts (understand file-backed data)
- packages/shared/src/domain.ts (existing Zod schemas)

What to build:

PART 1 — Password hashing
Install: pnpm add bcrypt @types/bcrypt --filter @muloo/api
Find all places passwords are stored or compared in app.ts and server.ts
Replace storage with bcrypt.hash(password, 12)
Replace comparison with bcrypt.compare(input, hash)
Create scripts/hash-existing-passwords.ts — reads all WorkspaceUser and ClientPortalUser records, hashes plaintext passwords, updates DB

PART 2 — Remove hardcoded credentials
Find and remove all jarrud/deployos hardcoded auth checks
If a dev backdoor exists, gate it with: if (process.env.NODE_ENV !== 'production')
Remove any console.log statements that print tokens, passwords, or session data

PART 3 — Rate limiting
Install: pnpm add hono-rate-limiter --filter @muloo/api
Apply strict limiter (10 req/15min) to: /api/auth/*, /api/client-auth/*
Apply general limiter (200 req/min) to: /api/*
Use x-forwarded-for header as key

PART 4 — File system → Prisma migration
Read packages/file-system/src/projects.ts fully
Identify all fields loaded from files that are NOT in the Prisma Project model
Add missing fields (blueprintData Json?, discoveryData Json?, standardsData Json?) to schema.prisma
Run migration: pnpm prisma migrate dev --name add-project-json-fields
Create scripts/migrate-file-data-to-db.ts — reads /data/projects/ directory, upserts data into Prisma
Update loadProjectById() to read from Prisma first, file system as fallback with deprecation warning

PART 5 — Input validation
Add Zod validation to these endpoints (use existing schemas from packages/shared/src/domain.ts where they exist, create inline schemas where they don't):
- POST /api/auth/login
- POST /api/client-auth/login
- POST /api/projects (create project)
- POST /api/clients (create client)
- POST /api/portal-session
- POST /api/agents/marketing-dashboard
- POST /api/agents/research

PART 6 — Audit log
Add AuditLog model to prisma/schema.prisma (spec has full definition)
Run migration: pnpm prisma migrate dev --name add-audit-log
Create audit() helper function in apps/api/src/lib/audit.ts
Call audit() in: task status changes, ExecutionJob creation, property creation, user login, user logout

Run pnpm build after each part. Fix all TypeScript errors.
Run scripts/hash-existing-passwords.ts against dev DB to verify it works.
Report: all files modified, migrations run, build status, any security issues found beyond the spec.
```

---

## Sprint 06 — Simplified Email Composer + Agenda Builder

**Spec file:** `docs/sprint-06-email-composer-agenda-tool.md`

---

### Codex Prompt — Sprint 06

```
Implement Sprint 06 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-06-email-composer-agenda-tool.md

Before writing any code, read these files:
- apps/web/app/projects/[id]/page.tsx
- apps/web/app/components/ProjectOverview.tsx (look for the email composer section)
- apps/api/src/app.ts (existing project endpoints)
- apps/api/src/server.ts (loadProjectById, project data shape)
- packages/shared/src/domain.ts (Project type)
- apps/api/prisma/schema.prisma (Project model)

What to build:

PART 1 — Simplified Email Composer
Find the existing email composer in ProjectOverview.tsx or the project page.
Strip it down to ONLY: plain textarea + voice dictation button + "Draft email" button + "Copy" button.
Remove: email intent dropdown, AI provider dropdown, model dropdown, extra instruction field, saved contacts, To/CC/Subject fields, "Clean up" button, "Send email" button.
Textarea placeholder: "Write notes here or use voice dictation. AI will use the project context to draft your email."
"Draft email" button: calls POST /api/projects/:projectId/email/draft with { notes: string }, replaces textarea content with returned draft.
"Copy" button: copies textarea to clipboard, shows "Copied!" for 2 seconds.

PART 2 — Email Draft API endpoint
Add POST /api/projects/:projectId/email/draft to apps/api/src/app.ts
Load project via loadProjectById(projectId)
Build email context: client name, project type, hubs in scope, platform packaging, status, quick wins (top 3), blueprint status
System prompt: "You are writing a professional but warm email on behalf of a HubSpot consultant named {owner}. Use the project context to make the email specific and relevant. Keep it concise, direct, and human. No corporate filler."
Use workspace AI provider (follow same pattern as portal audit agent)
Return: { draft: string }

PART 3 — Agenda Builder section
Add a collapsible "Agenda Builder" section to the project page (below email composer or as new section).
Fields: Session type dropdown (Workshop/Onboarding, Discovery, Check-in/Status Call, Kick-off Meeting), Date (optional), Duration dropdown (30min, 1hr, 2hrs, Half day, Full day), Notes (optional short text).
"Generate Agenda" button: calls POST /api/projects/:projectId/agenda/generate.
Output renders in a read-only styled block below with a "Copy agenda" button.
Last generated agenda persists on page reload (loaded from project.lastAgenda).

PART 4 — Agenda Generate API endpoint
Add POST /api/projects/:projectId/agenda/generate to apps/api/src/app.ts
Build agenda context from: clientName, projectType, hubsInScope, platformPackaging, status, quickWins, blueprint open tasks (top 8), open discovery sessions, client inputs (top 5 answered), prepareNotes (first 400 chars).
Use workspace AI provider.
System prompt: "You are a HubSpot implementation consultant building a structured meeting agenda. Use the project context to create a relevant, time-boxed agenda. Format: plain text with time slots, section titles, and brief bullet points. Do not pad it."
Save result to project.lastAgenda (Json field): { sessionType, generatedAt, content }
Return: { agenda: string }

PART 5 — Prisma schema update
Add lastAgenda Json? to Project model in apps/api/prisma/schema.prisma
Run migration: pnpm prisma migrate dev --name add-project-last-agenda (from apps/api/)

Run pnpm build after each part. Fix all TypeScript errors.
Report: all files modified, migration status, build status.
```

---

## Sprint 07 — UX Redesign: Layout, Navigation, and Command Centre

**Spec file:** `docs/sprint-07-ux-redesign.md`

---

### Codex Prompt — Sprint 07

```
Implement Sprint 07 for the Muloo Deploy OS platform.

Read the full spec at: docs/sprint-07-ux-redesign.md

This is a LAYOUT AND COMPONENT REORGANISATION sprint — not a feature rewrite.
The goal is to move existing code into a better structure. Do not rewrite business logic.
Everything that works today must still work — just in a better layout.

Before writing any code, read these files in order:
1. apps/web/app/components/ProjectOverview.tsx — understand all sections and their state (it's 5000+ lines, read carefully)
2. apps/web/app/components/MulooCommandCentre.tsx — current command centre
3. apps/web/app/runs/page.tsx — current runs page
4. apps/web/app/components/AppShell.tsx — sidebar and shell structure
5. apps/web/app/components/Sidebar.tsx — current nav items
6. apps/api/src/app.ts — check which API endpoints exist for stat cards

BUILD ORDER — complete each part fully before moving to the next, run pnpm build after each:

PART 1 — Sidebar Navigation Restructure
File: apps/web/app/components/Sidebar.tsx
Add section dividers with labels: DELIVERY, OPERATIONS, ADMIN
Group items:
  - Top: Command Centre (/), Inbox (/inbox)
  - DELIVERY: Projects (/projects), Clients (/clients)
  - OPERATIONS: Portal Ops (/projects/portal-ops), Runs (/runs), Agents (/agents)
  - ADMIN: Templates (/templates), Settings (/settings)
Remove "Operations Hub" as a separate nav item — redirect /operations to /runs
Keep "Internal Delivery Workspace" label at the bottom
Tailwind: section label as text-xs uppercase tracking-wider text-zinc-500 px-3 py-2 mt-4

PART 2 — Command Centre Redesign
File: apps/web/app/components/MulooCommandCentre.tsx
Replace the current projects list layout with:
  1. Greeting header: "Good morning, {name}. {day} {date}"
  2. Four stat cards in a row: Active projects, Awaiting client, Overdue tasks, Runs queued
     Each stat card: large number, label, status colour (neutral/warning/danger), clickable href
     Data: GET /api/projects?status=in-flight&count=true, GET /api/projects?status=awaiting_client&count=true, GET /api/tasks?overdue=true&count=true, GET /api/execution-jobs?status=queued&count=true
     If endpoints don't exist yet, mock with placeholder data and add a TODO comment
  3. "Needs Attention" list — top 5 items where (task.overdue OR status=awaiting_client OR blueprint_approved_no_delivery). Show: project name · reason · age. Colour: red=overdue, amber=waiting, green=ready to act. Click navigates to project.
     Fetch from GET /api/projects/needs-attention — if endpoint doesn't exist, create it in apps/api/src/app.ts (returns top 5 projects matching above criteria, ordered by urgency)
  4. Two-column lower section:
     Left: Active Projects — top 6 by lastUpdated, showing name + client + status badge. "View all projects →" link
     Right: Recent Runs — last 5 execution jobs with name, project, status badge, time. "View all runs →" link
     Fetch: GET /api/projects?status=active&limit=6 and GET /api/execution-jobs?limit=5
Limit everything — no pagination on command centre. All data capped as above.

PART 3 — Project Detail Layout Shell
Create new directory: apps/web/app/components/project/
Create: apps/web/app/components/project/ProjectDetailLayout.tsx
  - Top bar: back link ("← Back to projects"), project name (h1), status dropdown badge, Actions button
  - Subtitle row: client name · project type · hubs in scope
  - Tab navigation: [Overview] [Discovery] [Plan] [Delivery] [Comms] [Portal]
    Active tab: border-b-2 border-violet-500 text-white. Inactive: text-zinc-400 hover:text-white
  - Two-column body: main content area (flex-1) + context sidebar (w-72, sticky)
  - Accept: project data as prop, activeTab as state, children as tab content slot
  - Tab navigation controls which tab component renders in the main area

Create: apps/web/app/components/project/ProjectContextSidebar.tsx
  Extract the "Project Context" collapsible section from ProjectOverview.tsx into this component.
  This sidebar is ALWAYS VISIBLE — not collapsible.
  Sections (no collapsible wrappers, just labelled blocks):
    CLIENT: client name, contact email
    PORTAL: portal URL, hub tier, connection status dot (green/red)
    SNAPSHOT: contacts count, deals count, properties count / custom count
    OWNER: owner name
    HUBS IN SCOPE: hub chips
    PLATFORM: packaging name, description
    QUICK WINS: X total · X open · X resolved
    [Refresh Snapshot] button
  Width: w-72, sticky top-0, overflow-y-auto, max-h-screen
  Styling: bg-zinc-800 rounded-lg p-4, section labels as text-xs uppercase tracking-wider text-zinc-500 mb-1

PART 4 — Tab Components
Create these files (move existing section content from ProjectOverview.tsx into them — do not rewrite logic):
  apps/web/app/components/project/tabs/OverviewTab.tsx
    Content: project status card, human inputs summary (answered vs total), blueprint status with link, agent summary (risks/tools/recommendations), quick wins list (expandable, show/resolve inline)
  apps/web/app/components/project/tabs/DiscoveryTab.tsx
    Content: Q&A sessions tracker, discovery progress bar, [Open Discovery →] button to /projects/[id]/discovery, prepare notes preview with [Open Prepare →] link
  apps/web/app/components/project/tabs/PlanTab.tsx
    Content: blueprint status + [View Blueprint →] / [Generate Blueprint] button, scope & approval status, [Open Quote →] / [Open Proposal →] buttons, working doc link
  apps/web/app/components/project/tabs/DeliveryTab.tsx
    Content: open tasks count + status breakdown, [Open Delivery Board →] as primary CTA, change management summary, [View Changes →] link
  apps/web/app/components/project/tabs/CommsTab.tsx
    Two-column layout (equal width, gap-6):
    Left column: EmailComposer (simplified version from Sprint 06)
    Right column: AgendaBuilder (from Sprint 06)
    These are SIDE BY SIDE — not stacked.
    Also add to AgendaBuilder in this tab:
      - Session history: show last 3 generated agendas as collapsed rows below the generator (from project.agendaHistory or project.lastAgenda)
      - Smart duration pre-fill: on session type select, pre-fill duration (Workshop→Full day, Discovery→2hrs, Kick-off→1hr, Check-in→30min)
      - [+ Add to Google Calendar] button when a date is set — calls gcal MCP create event (title: "{sessionType} — {clientName}", description: agenda content, date from input). Show "Event created ✓" on success.
  apps/web/app/components/project/tabs/PortalTab.tsx
    Content: client portal user management (invite/reset/access), Portal Ops quick actions, HubSpot portal connection status

PART 5 — Wire up ProjectDetailLayout in ProjectOverview.tsx
Update ProjectOverview.tsx to use ProjectDetailLayout as the outer shell.
Pass project data to ProjectDetailLayout and ProjectContextSidebar.
Map each existing section to its corresponding tab:
  - Overview-related sections → OverviewTab
  - Discovery sections → DiscoveryTab
  - Plan/blueprint sections → PlanTab
  - Delivery/tasks sections → DeliveryTab
  - Email + agenda sections → CommsTab
  - Portal sections → PortalTab
Default active tab: "overview"
The existing collapsible panels become tab content — remove the CollapsibleSection wrappers for content that has moved into tabs.
IMPORTANT: Do not remove or break any existing API calls, state management, or business logic. Only move UI structure.

PART 6 — Runs Page Redesign
File: apps/web/app/runs/page.tsx
Add filter tabs at top: All / Queued / Running / Complete / Failed (filter by execution job status)
Group results by day: TODAY, YESTERDAY, THIS WEEK (group by createdAt date)
Each run is a single collapsed row: status dot, run name, project name, status badge, time. Click to expand showing output log, error log, cowork instruction.
Merge "workflow runs" and "agent runs" into one feed — show type as a small badge (e.g. "agent", "workflow")
Add search input (filter by project name or module key, client-side)
Pagination: 20 per page
Remove the two-section layout (workflow runs / agent runs)

PART 7 — Portal Ops Improvements
File: wherever the Portal Ops page component lives (check apps/web/app/components/ or apps/web/app/projects/portal-ops/)
Add portal health badge next to portal selector: green dot (connected), amber dot (snapshot stale >24hrs), red dot (disconnected)
Add "Recent Runs" panel on right side — last 5 execution jobs for the selected portal with status badges and timestamps
After request is submitted, show detected capability as a chip (e.g. dashboards_and_reporting) before the execution path renders
Show execution tier badge on each result (API / Browser Session / Cowork / Manual)

Tailwind conventions throughout:
- Dark theme: bg-zinc-900 (page), bg-zinc-800 (card), bg-zinc-700 (hover/input)
- Text: text-white (primary), text-zinc-300 (secondary), text-zinc-500 (muted/labels)
- Borders: border-zinc-700, border-zinc-800
- Active tab: border-b-2 border-violet-500 text-white
- Context sidebar: w-72, sticky top-0, h-screen overflow-y-auto
- Accent colour for buttons/links: check existing components for the violet/purple hex in use

DO NOT touch:
- /client/* routes (client portal — completely separate)
- Auth logic in AppShell.tsx and AuthGate
- The workflow nav bar on project sub-pages (/projects/[id]/discovery, /delivery, etc.)
- Any existing API endpoints (don't delete or rename)

Run pnpm build after each part. Fix ALL TypeScript errors before moving to the next part.
Report: all files created/modified, build status after each part, any blockers.
```

---

## Sprint 08 — HubSpot Write Client + Core Agent Completions

**Spec file:** `docs/agent-capability-roadmap.md`

---

### Codex Prompt — Sprint 08

```
Implement Sprint 08 for the Muloo Deploy OS platform.

Reference docs:
- docs/agent-capability-roadmap.md (full context on why we're building this)
- apps/api/prisma/schema.prisma (current data model)
- apps/api/src/queue/jobRouter.ts (existing job routing)
- apps/api/src/queue/processors/ (existing processor stubs to complete)
- packages/browser-session-executor/src/BrowserSessionExecutor.ts (already built)

Before writing any code, read ALL files listed above.

PART 1 — Create packages/hubspot-client/

Create a new package: packages/hubspot-client/
Add to pnpm workspace in pnpm-workspace.yaml if not already there.

Create packages/hubspot-client/package.json:
{
  "name": "@muloo/hubspot-client",
  "version": "0.1.0",
  "main": "src/index.ts",
  "dependencies": { "axios": "^1.6.0" }
}

Create packages/hubspot-client/src/HubSpotWriteClient.ts with this class:

constructor(config: { portalId: string; privateAppToken: string })

Methods — all use Authorization: Bearer {privateAppToken} header:

  Properties:
    getProperty(objectType: string, name: string): Promise<HSProperty | null>
      GET https://api.hubapi.com/crm/v3/properties/{objectType}/{name}
      Return null on 404, throw on other errors.

    createProperty(objectType: string, spec: HSPropertySpec): Promise<HSProperty>
      POST https://api.hubapi.com/crm/v3/properties/{objectType}

    updateProperty(objectType: string, name: string, patch: Partial<HSPropertySpec>): Promise<HSProperty>
      PATCH https://api.hubapi.com/crm/v3/properties/{objectType}/{name}

    listProperties(objectType: string): Promise<HSProperty[]>
      GET https://api.hubapi.com/crm/v3/properties/{objectType}

  Pipelines:
    getPipelines(objectType: string): Promise<HSPipeline[]>
      GET https://api.hubapi.com/crm/v3/pipelines/{objectType}

    createPipeline(objectType: string, spec: HSPipelineSpec): Promise<HSPipeline>
      POST https://api.hubapi.com/crm/v3/pipelines/{objectType}

    updatePipelineStage(objectType: string, pipelineId: string, stageId: string, patch: Partial<HSStageSpec>): Promise<HSStage>
      PATCH https://api.hubapi.com/crm/v3/pipelines/{objectType}/{pipelineId}/stages/{stageId}

  Lists:
    createList(spec: HSListSpec): Promise<HSList>
      POST https://api.hubapi.com/crm/v3/lists

  Workflows:
    getWorkflows(): Promise<HSWorkflow[]>
      GET https://api.hubapi.com/automation/v4/flows
      (Note: v4 API, requires automation scope)

    createWorkflow(spec: HSWorkflowSpec): Promise<HSWorkflow>
      POST https://api.hubapi.com/automation/v4/flows

  Marketing content:
    createBlogPost(spec: HSBlogPostSpec): Promise<HSBlogPost>
      POST https://api.hubapi.com/cms/v3/blogs/posts

    scheduleBlogPost(id: string, publishDate: string): Promise<void>
      POST https://api.hubapi.com/cms/v3/blogs/posts/{id}/schedule
      Body: { publishDate }

    createMarketingEmail(spec: HSEmailSpec): Promise<HSEmail>
      POST https://api.hubapi.com/marketing/v3/emails

    createCampaign(spec: HSCampaignSpec): Promise<HSCampaign>
      POST https://api.hubapi.com/marketing/v3/campaigns

Define TypeScript types for all Spec and Result types based on HubSpot API docs conventions.
Export everything from packages/hubspot-client/src/index.ts.

PART 2 — Update PortalSession schema

In apps/api/prisma/schema.prisma, add to the PortalSession model:
  privateAppToken  String?

Run: pnpm prisma migrate dev --name add-portal-private-app-token (from apps/api/)

Add PATCH /api/portal-sessions/:portalId/token to apps/api/src/app.ts:
  Body: { privateAppToken: string }
  Updates PortalSession.privateAppToken for the given portalId
  Returns: { success: true }

PART 3 — Complete processors/portalAudit.ts

The existing stub should be replaced with a working implementation:

1. Load PortalSession for the portalId. If no privateAppToken, set job status to 'needs_cowork' and return.
2. Instantiate HubSpotWriteClient with the private app token.
3. Fetch in parallel:
   - All contact properties (listProperties('contacts'))
   - All deal pipelines (getPipelines('deals'))
   - All workflows (getWorkflows())
   - Portal snapshot (MCP or stored PortalSession data)
4. Build an analysis prompt for Claude:
   System: "You are a HubSpot implementation expert auditing a client portal for a consultancy called Muloo."
   Include: property list, pipeline stages, workflow count + names, snapshot counts
   Ask for: top 10 issues with severity (critical/medium/low), 5 quick wins, overall health score (0-100)
5. Call Claude API (use ANTHROPIC_API_KEY from env, claude-sonnet-4-6 model)
6. Parse response into structured { healthScore, issues[], quickWins[], summary }
7. Save to job.outputData as the audit result
8. Update job status to 'complete'

PART 4 — Complete processors/propertyApply.ts

The existing stub should be replaced with a working implementation:

Job data shape: { portalId: string, properties: HSPropertySpec[] }

1. Load PortalSession + privateAppToken. Fail gracefully if missing.
2. Instantiate HubSpotWriteClient.
3. For each property in job.data.properties:
   a. Call getProperty(objectType, name)
   b. If exists and matches spec → add to skipped[]
   c. If exists but has different options → call updateProperty → add to updated[]
   d. If not found → call createProperty → add to created[]
   e. On error → add to failed[] with error message
4. Return diff: { created, updated, skipped, failed } as job.outputData
5. Update job status to 'complete' (or 'partial' if any failed)

PART 5 — Complete processors/dashboardBuild.ts

Job data shape: { portalId: string, templateId: string, dashboardName?: string }

1. Load PortalSession including csrfToken and hubspotSessionCookie.
   If missing, set status to 'needs_cowork' with a CoworkInstruction.
2. Instantiate BrowserSessionExecutor with the session credentials.
3. Load the report template by templateId from the report-templates package.
4. For each report in the template:
   a. Call BrowserSessionExecutor.createReport(reportSpec)
   b. Collect report IDs
5. Call BrowserSessionExecutor.createDashboard({ name, reportIds })
6. Save dashboard URL + report IDs to job.outputData
7. Update job status to 'complete'

PART 6 — Wire private app token into Portal Ops UI

In apps/web (find the Portal Ops page or PortalTab in project detail):
Add a "Private App Token" input field under the portal connection section.
Label: "HubSpot Private App Token"
Placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
Help text: "Required for property creation and workflow building. Create a private app in HubSpot → Settings → Integrations → Private Apps."
On save: calls PATCH /api/portal-sessions/:portalId/token
Shows green "Saved" confirmation, masks the token after save.

Run pnpm build after each part. Fix all TypeScript errors before moving on.
Report: all files created/modified, migration status, build output.
```

---

## Sprint 09 — Marketing Agent Pack (Partner Platform)

**Spec file:** `docs/partner-platform-and-breeze-spec.md`

---

### Codex Prompt — Sprint 09

```
Implement Sprint 09 for the Muloo Deploy OS platform.

Reference docs:
- docs/partner-platform-and-breeze-spec.md (full context — read this first)
- apps/api/src/queue/jobRouter.ts (existing job routing — you're adding new job types)
- packages/hubspot-client/src/index.ts (HubSpotWriteClient built in Sprint 08)
- apps/api/src/app.ts (existing API routes)
- apps/api/prisma/schema.prisma (data model)

Read ALL of the above before writing any code.

OVERVIEW
This sprint adds marketing-focused agent processors so Muloo's partner (Tusk, a marketing agency) can submit marketing briefs and have agents build the HubSpot content for them.

PART 1 — Shared: Marketing job data types

Create packages/shared/src/marketing-jobs.ts with these types:

BlogPostJobData: {
  portalId: string
  projectId: string
  topic: string
  targetAudience: string
  keywords?: string[]
  tone?: string
  wordCount?: number
  blogId?: string // HubSpot blog ID to publish to
}

EmailCampaignJobData: {
  portalId: string
  projectId: string
  campaignGoal: string
  audience: string
  cta: string
  tone?: string
  subject?: string
}

NurtureSequenceJobData: {
  portalId: string
  projectId: string
  persona: string
  triggerEvent: string
  sequenceLength: number // number of emails
  goal: string
  enrollmentCriteria?: string
}

SocialPostPackageJobData: {
  portalId: string
  projectId: string
  topic: string
  platforms: ('linkedin' | 'twitter' | 'facebook' | 'instagram')[]
  tone?: string
  postCount?: number // per platform, default 3
  imageBrief?: string
}

LeadGenCampaignJobData: {
  portalId: string
  projectId: string
  campaignName: string
  targetPersona: string
  contentThemes: string[]
  includeEmailSequence?: boolean
  includeLandingPage?: boolean
  includeDashboard?: boolean
}

Export all from packages/shared/src/index.ts.

PART 2 — Blog Post Agent: processors/blogPostCreate.ts

1. Load PortalSession + privateAppToken.
2. Instantiate HubSpotWriteClient.
3. Generate blog post via Claude:
   System: "You are an expert B2B content writer creating a HubSpot blog post. Write for a business audience. Structure: H1 title, intro paragraph, 3-5 H2 sections with 2-3 paragraphs each, conclusion with CTA."
   Include: topic, targetAudience, keywords, tone, wordCount in the prompt.
4. Parse Claude's response to extract: title, htmlContent (convert markdown to basic HTML), metaDescription (generate if not in response), tags (infer from keywords).
5. Call hubspotClient.createBlogPost({
     name: title,
     htmlTitle: title,
     postBody: htmlContent,
     metaDescription,
     blogId: jobData.blogId || await getDefaultBlogId(hubspotClient), // get first available blog
     currentState: 'DRAFT'
   })
6. Save { postId, title, previewUrl } to job.outputData.
7. Update job status to 'complete'.

Helper: getDefaultBlogId — calls GET https://api.hubapi.com/cms/v3/blogs/blogs, returns first blog's id.

PART 3 — Marketing Email Agent: processors/emailCampaignCreate.ts

1. Load PortalSession + privateAppToken.
2. Instantiate HubSpotWriteClient.
3. Generate email via Claude:
   System: "You are an expert B2B email marketer. Write a marketing email. Return JSON with: subjectLine (string), previewText (string), bodyHtml (string with basic HTML — p, h2, ul, strong tags only, no inline styles)."
   Include: campaignGoal, audience, cta, tone, subject hint.
4. Parse JSON response.
5. Create email via hubspotClient.createMarketingEmail({
     name: `[Draft] ${subjectLine}`,
     subject: subjectLine,
     previewText,
     content: { body: bodyHtml }
   })
6. Save { emailId, subjectLine, editUrl } to job.outputData.
7. Update job status to 'complete'.

PART 4 — Social Post Package Agent: processors/socialPostPackage.ts

No HubSpot API call needed — this is Claude-only output.

1. Generate posts via Claude:
   System: "You are a social media strategist. For each platform, write {postCount} post variants. Return as JSON array: [{ platform, variant: 1|2|3, copy, hashtags: string[], characterCount, bestTimeToPost, imageBrief }]"
   Include: topic, platforms, tone, postCount.
2. Parse JSON array.
3. Save structured posts array to job.outputData.
4. Update job status to 'complete'.
Note: No HubSpot API required. The output is a content package for human review + manual posting.

PART 5 — Nurture Sequence Agent: processors/nurtureSequenceCreate.ts

This orchestrates multiple operations — treat it carefully.

1. Load PortalSession + privateAppToken.
2. Instantiate HubSpotWriteClient.
3. Generate N email subjects + body content via Claude (single prompt, return JSON array of emails).
4. Create each email via createMarketingEmail, collect email IDs.
5. Build a workflow spec for a contact-based workflow:
   - Trigger: enrollment criteria (from jobData.enrollmentCriteria or generate a reasonable default)
   - Actions: array of DELAY (3 days) + SEND_EMAIL pairs for each email
6. Create workflow via hubspotClient.createWorkflow(workflowSpec).
7. Save { workflowId, emailIds, workflowEditUrl } to job.outputData.
8. Update job status to 'complete'.

PART 6 — Register new job types in jobRouter.ts

Add to the job type → processor map:
  'blog_post_create' → blogPostCreate processor
  'email_campaign_create' → emailCampaignCreate processor
  'social_post_package' → socialPostPackage processor
  'nurture_sequence_create' → nurtureSequenceCreate processor

PART 7 — New API endpoint: POST /api/marketing-jobs

Add to apps/api/src/app.ts:

POST /api/marketing-jobs
Body: {
  projectId: string,
  jobType: 'blog_post_create' | 'email_campaign_create' | 'social_post_package' | 'nurture_sequence_create',
  briefData: object // job-specific data
}

1. Load project, get portalId from project's connected portal.
2. Validate briefData has required fields for the jobType.
3. Queue the ExecutionJob via BullMQ with jobType + { ...briefData, portalId, projectId }.
4. Return { jobId, status: 'queued' }.

PART 8 — Inbox integration

When a marketing job completes, its output should appear in the project's notification feed.
After processor sets status to 'complete', emit a notification to the project:
  Create a new record in a Notification model (add to schema if needed):
    { projectId, jobId, type: 'marketing_job_complete', title, summary, outputUrl, createdAt }

If Notification model doesn't exist yet, add it to schema.prisma:
  model Notification {
    id          String   @id @default(cuid())
    projectId   String
    project     Project  @relation(fields: [projectId], references: [id])
    jobId       String?
    type        String
    title       String
    summary     String?
    outputUrl   String?
    read        Boolean  @default(false)
    createdAt   DateTime @default(now())
  }

Add GET /api/projects/:id/notifications to apps/api/src/app.ts — returns last 20 notifications for a project, ordered by createdAt desc.

Run pnpm build after each part. Fix all TypeScript errors before moving on.
Report: all files created/modified, migration status, new job types registered, build output.
```

---

## Sprint order summary

| Sprint | Key deliverable | Status |
|---|---|---|
| 00 | Browser session API, report templates, dashboard agent scaffold | ✅ Complete |
| 01 | BullMQ job worker | ✅ Complete |
| 02 | Dashboard agent completion, HubSpot write ops | Ready to start |
| 03 | Cowork pickup, Perplexity research agent | Ready to start |
| 04 | Task board, approval gates | Ready to start |
| 05 | Security, data model cleanup | Ready to start |
| 06 | Simplified email composer + agenda builder | Ready to start |
| 07 | UX redesign — layout, navigation, command centre | Ready to start (after 06) |
| 08 | HubSpot Write Client + core agent completions | Ready to start (needs private app token) |
| 09 | Marketing Agent Pack — blog, email, social, nurture | Ready to start (after 08) |
| 10 | Partner Platform UI — Tusk access, job submission, Inbox | Ready to start (after 09) |
| 11 | Breeze Agent Tools — HubSpot app, 4 tools, API endpoints | Ready to start (after 08) |

Sprints 02 and 03 can run in parallel.
Sprint 04 can start once Sprint 01 is deployed.
Sprint 05 runs last in backend sequence.
Sprint 06 can run independently.
Sprint 07 depends on Sprint 06.
Sprint 08 needs a HubSpot private app token configured for at least one portal.
Sprint 09 depends on Sprint 08 (HubSpotWriteClient).
Sprints 10 and 11 can run in parallel after Sprint 08.

---

*Compiled: 26 Mar 2026*
