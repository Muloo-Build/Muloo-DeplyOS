# Muloo Deploy OS

Internal execution platform for Muloo delivery operations and HubSpot onboarding automation.

## Architecture

This is a **pnpm monorepo** with the following structure:

- `apps/web` — Next.js 14 frontend (served on port 5000)
- `apps/api` — Hono/Node.js API backend (served on port 3001 by default)
- `packages/` — Shared libraries (config, shared, hubspot-client, executor, etc.)

## Running on Replit

The workflow `Start application` runs:
```
pnpm install --no-frozen-lockfile && cd apps/web && pnpm dev
```

This starts the Next.js frontend only. The API backend requires additional environment variables to function.

## Environment Variables Required

See `.env.example` for a full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for job queue (BullMQ) |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token |
| `HUBSPOT_PORTAL_ID` | HubSpot portal ID |
| `OPENAI_API_KEY` | OpenAI API key |
| `API_PORT` | API server port (default: 3001) |

## Starting the Full Stack

To run both frontend and API:
```
pnpm install --no-frozen-lockfile && pnpm dev
```

The root `pnpm dev` script (`scripts/run-services.js dev`) will:
1. Run `prisma generate` in `apps/api`
2. Compile TypeScript for the monorepo
3. Start both the Next.js frontend (port 5000) and the API (port 3001)

Note: The API startup requires `DATABASE_URL` (Prisma) and `REDIS_URL` (BullMQ).

## Key Config Files

- `apps/web/next.config.js` — Next.js config, proxies `/api/*` to the API server
- `apps/api/src/index.ts` — API entry point
- `scripts/run-services.js` — Orchestrates dev/start for both services
- `.env.example` — Template for environment variables

## Port Configuration

- Frontend: port **5000** (Replit webview)
- API: port **3001** (configurable via `API_PORT` env var)

## Package Manager

Uses **pnpm** (v10+, included with nodejs-18 module). The `packageManager` field was removed from root `package.json` to avoid corepack version enforcement issues on Replit.

## UI Component Conventions

- **Toast**: `useToast()` hook → `toast.success("...")` / `toast.error("...")`. `ToastProvider` is mounted in both `AppShell` and `ClientShell`. All async operation feedback must use toasts, not inline state banners.
- **LoadingSkeleton**: Use `<SkeletonRows count={N} height="h-28" gap="gap-4" rounded="rounded-2xl" />` instead of manual `[0,1,2].map(animate-pulse)` loops. `<SkeletonBlock />` for single-panel skeletons.
- **EmptyState**: Use `<EmptyState icon={...} title="..." description="..." primaryCta={{ label, href }} />` for zero-data states. Supports `className` override for inline use inside cards.
- **Breadcrumb**: `<Breadcrumb items={[{ label, href? }]} />` — use on any page deeper than one level from root. Last item (no href) renders in white. All other items link in muted text with hover-to-white.

## Completed Features (recent)

- **Systematic UX sweep (May 2026)**: Full improvement pass across all key screens:
  - `Breadcrumb.tsx` created — reusable page-level breadcrumb nav component
  - `ProjectsDashboard` fully rewired: `useToast` replaces inline error banners; `SkeletonRows` replaces manual skeleton loops; `EmptyState` + `FolderKanban` icon for zero-project state; stats cards with colour-coded values
  - `ClientsWorkspace`: all async success/error messages (`createClient`, `saveClientProfile`, `addContact`, `deleteClient`, etc.) migrated to `toast.success()` / `toast.error()` — inline `error` retained only for form validation
  - Delivery page: redundant "Project Overview" button removed (covered by WorkflowNav); "Back to overview" text link replaced with `Breadcrumb`; "Change Mgmt" label cleaned to "Change log"
  - Audit page: `Breadcrumb` added; loading state uses `SkeletonBlock`; "Back to project overview" button added to the no-portal-connected state
  - Skeleton sweep: `SkeletonRows` adopted in `ProjectPrepareWorkspace`, `DiscoveryWorkspace`, `BlueprintWorkspace`, `ProjectOverview`, `ProjectEditWorkspace`, `PortalAuditWorkspace` — replacing all manual `[0,1,2].map(animate-pulse)` patterns
- **DB migration**: `executionTier` and `coworkInstruction` columns added to `ExecutionJob` table; `portalQuoteEnabled` boolean added to `Project` (default `true`)
- **AI assistant**: Enhanced with live workspace context (active projects, clients, open tasks, blocked counts)
- **Client portal rebuild**: Full redesign — tab-based workspace (Overview / Tasks / Messages / Delivery), cleaner `ClientShell` nav with active state, improved `ClientProjectsDashboard` with status badges
- **Portal quote toggle**: `portalQuoteEnabled` on Project controls whether the quote section is visible in the client portal. Toggled via `PATCH /api/projects/:id/portal-settings`. Toggle UI in the Portal tab of the operator workspace.
- **Message delete**: `DELETE /api/projects/:id/messages/:msgId` (operator) and `DELETE /api/client/projects/:id/messages/:msgId` (client, own messages only)
- **Delivery board client mode**: Renamed "Planned Human Hours" → "Planned Time", "Actual Human Hours" → "Time Logged", "Human Variance" → "Variance"; hides Ready Agent Tasks metric and all internal execution details (execution path, readiness, validation, agent name, QA output) for `mode="client"`
- **Comms tab**: `ProjectMessagesPanel` allows operators to send client-visible messages per project
- **Human QA review panel**: Added to Delivery Board — shows agent output summary when `qaRequired=true` and the execution job completes; operators can "Mark QA Passed" (→ done) or "Send Back for Rework" (→ todo)
- **Portal audit model selector**: Full stack — `providerKey`/`modelId` passed through to `callAuditModel()`; frontend dropdown in `PortalAuditWorkspace.tsx`
- **Operator portal preview**: 1-hour preview tokens; "Preview client portal →" in Portal and Overview tabs
