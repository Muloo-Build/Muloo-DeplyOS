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

## Sprint order summary

| Sprint | Key deliverable | Status |
|---|---|---|
| 00 | Browser session API, report templates, dashboard agent scaffold | ✅ Complete |
| 01 | BullMQ job worker | ✅ Complete |
| 02 | Dashboard agent completion, HubSpot write ops | Ready to start |
| 03 | Cowork pickup, Perplexity research agent | Ready to start |
| 04 | Task board, approval gates | Ready to start |
| 05 | Security, data model cleanup | Ready to start |

Sprints 02 and 03 can run in parallel.
Sprint 04 can start once Sprint 01 is deployed.
Sprint 05 runs last.

---

*Compiled: 26 Mar 2026*
