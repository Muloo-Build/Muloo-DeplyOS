# Muloo Deploy OS

Internal execution platform for Muloo — HubSpot systems partner. Manages the full delivery lifecycle from intake and discovery through blueprint, deployment, QA, and ongoing support. Connects Clients (companies being served), Partners (external delivery collaborators), and Projects (the work itself).

## Architecture

This is a **pnpm monorepo** with the following structure:

- `apps/web` — Next.js 14 frontend (served on port 5000)
- `apps/api` — Hono/Node.js API backend (served on port 3001 by default)
- `packages/` — Shared libraries (config, shared, hubspot-client, executor, etc.)

## Running on Replit

The workflow `Start application` runs:
```
pnpm install --no-frozen-lockfile && pnpm dev
```

This starts the Next.js frontend only. The API backend requires additional environment variables to function.

## Dev Login

- Username: `jarrud`
- Password: `deployos`
- Requires: `MULOO_DEV_BYPASS=true` environment variable

## Environment Variables Required

See `.env.example` for a full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for job queue (BullMQ) |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token |
| `HUBSPOT_PORTAL_ID` | HubSpot portal ID |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude) |
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

## Platform Mental Model

**Deploy OS** is the internal brain that routes all delivery. Key surfaces:
- **Command Centre** — daily cockpit: Gmail watchlists, calendar, private tasks, AI email composer, projects in delivery, automation runs, industry signal feed
- **Projects** — full project lifecycle: create → prepare → discover → blueprint → deliver → QA → track
- **Clients** — companies Muloo is delivering HubSpot work for (implementation, optimisation, integration, support)
- **Partners** — external delivery collaborators (agencies, devs, Tusk, HubResolution) who receive structured briefs
- **Inbox** — work request triage: incoming quote/change requests route to projects; project messaging alongside
- **Sales** — Quotes, Products, Retainers, Invoices, Financials
- **Automation** — Portal Ops (HubSpot execution), Runs (execution log), Agents (AI agent studio)
- **Admin** — Templates (delivery pattern library), Settings

## Project Pathways

Projects route through different delivery paths based on engagement type:
- **Fast Track** — scoped, low-discovery implementation
- **Audit First** — portal assessment before scoping
- **Discovery Led** — structured discovery sessions → blueprint → quote → delivery
- **Technical Discovery** — engineering-led, custom build path
- **CMS Delivery** — Content Hub / website build
- **Retainer Workstream** — ongoing monthly delivery

## Navigation Structure

```
Command Centre   (daily cockpit — most important screen)
Inbox            (work request triage + project messages)

DELIVERY
  Projects       (all project delivery)
  Clients        (companies being served)
  Partners       (external delivery collaborators)

SALES
  Quotes
  Products
  Retainers
  Invoices
  Financials

AUTOMATION
  Portal Ops     (direct HubSpot execution against client portals)
  Runs           (unified execution log)
  Agents         (AI agent studio + HubSpot agent workbench)

ADMIN
  Templates      (delivery template library)
  Settings       (connections, team, AI routing, email, products)
```

## UI Component Conventions

- **Toast**: `useToast()` hook → `toast.success("...")` / `toast.error("...")`. `ToastProvider` is mounted in both `AppShell` and `ClientShell`. All async operation feedback must use toasts, not inline state banners. Console warning `[useToast] used outside ToastProvider` is suppressed outside dev mode.
- **LoadingSkeleton**: Use `<SkeletonRows count={N} height="h-28" gap="gap-4" rounded="rounded-2xl" />` instead of manual `[0,1,2].map(animate-pulse)` loops. `<SkeletonBlock />` for single-panel skeletons.
- **EmptyState**: Use `<EmptyState title="..." description="..." />` for zero-data states. Supports optional `primaryCta={{ label, href }}` and `className` override for inline use inside cards.
- **Breadcrumb**: `<Breadcrumb items={[{ label, href? }]} />` — use on any page deeper than one level from root. Last item (no href) renders in white. All other items link in muted text with hover-to-white.

## Key Component Sizes (for context)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `MulooCommandCentre.tsx` | 1631 | Daily cockpit — most important screen |
| `ClientsWorkspace.tsx` | 2930 | Shared component for Clients and Partners via `workspaceMode` prop |
| `ProjectOverview.tsx` | 2167 | Core project detail landing |
| `ProjectEditWorkspace.tsx` | 1848 | Full project edit form |
| `DeliveryBoard.tsx` | 2398 | Delivery kanban / task board |
| `ProjectChangeManagementWorkspace.tsx` | 1326 | Scope protection + change log |
| `ProjectPrepareWorkspace.tsx` | 1598 | Pre-meeting readiness prep |
| `DiscoveryWorkspace.tsx` | 1537 | Structured discovery sessions |
| `PortalAuditWorkspace.tsx` | 1166 | HubSpot portal audit engine |
| `ProjectPortalOps.tsx` | 1002 | Direct HubSpot API execution |
| `AgentStudio.tsx` | 653 | AI agent creation + management |
| `projects/new/page.tsx` | 2096 | New project creation wizard |

## Completed Features (most recent first)

### Project Contribution Workbooks (May 2026)
- **Schema**: `DiscoveryEvidence` extended with `resourceType`, `assignedContributorIds[]`, `ownerContributorId`, `workbookContent Json?` (parallel to existing `content` String?). New `DiscoveryQuestionLibraryItem` model for the reusable question bank (category, subcategory, questionText, helpText, answerType, options[], tags[], stakeholderType, defaultRequired, hubspot/website area links, complexityLevel).
- **Resource types**: `google_sheet | google_doc | google_form | pdf | miro_board | internal_workbook | external_url`. `internal_workbook` stores structured `{ version: 1, sections: [{ id, title, status, questions: [{ id, questionText, answerType, status, response }] }] }` directly in `workbookContent`.
- **Question library API**: `GET/POST/PATCH/DELETE /api/discovery-question-library*` for CRUD; `POST /api/projects/:p/workbooks/:w/questions/import` to copy library items into a workbook.
- **Internal operator UI**: `QuestionLibraryPicker.tsx` + `WorkbookContentEditor.tsx`; `ProjectWorkbooksPanel.tsx` rewritten to support resourceType selector and per-workbook Edit + From-library buttons. `ProjectReadinessSummary.tsx` upgraded to a 6-column grid (Workbooks / Questions answered / Questions total / Miro boards).
- **Client portal champion flow**: New routes `GET/POST /api/client/projects/:projectId/contributors`, `GET /api/client/projects/:projectId/workbooks`, `PATCH /api/client/projects/:projectId/workbooks/:workbookId/responses`. Champions can add stakeholders (created via `clientContact.upsert` + `projectContributor` with `createdByType: "client_champion"`, `approvalStatus: "pending_review"`) and answer their assigned workbook questions. New `ClientWorkbooksPanel.tsx` + `ClientContributorsPanel.tsx` wired into `ClientProjectWorkspace.tsx` as Workbooks + Contributors tabs.
- **Magnisol seed**: `prisma/seed-question-library.ts` (82 library items across 13 categories) and enhanced `prisma/seed-magnisol.ts` (3 contributors: Tara/Grant/Devan, 5 internal workbooks pre-populated with category-matched library questions, 1 Miro board resource). Both idempotent. Run with `npx tsx prisma/seed-question-library.ts && npx tsx prisma/seed-magnisol.ts` from `apps/api`.

### Architect Audit — Phase 0 + 1.1 (May 2026)
- **Sidebar**: collapsed from 5 groups (DELIVERY/SALES/AUTOMATION/OPERATIONS/ADMIN, 19 items) to 4 groups all visible above the fold:
  - WORK: Command Centre, Inbox, Projects, Clients, Partners
  - SELL: Quotes, Retainers, Invoices, Financials
  - LIBRARY: Workbooks, Question Library, Implementation Templates, Products, Agents
  - ADMIN: Settings, Skeleton Key
- Contacts and Runs removed from visible nav (routes still resolve at `/contacts` and `/runs`); Clients now active-highlights on `/contacts*`, Agents on `/runs*`
- Portal Ops link removed from sidebar (still reachable from individual projects)
- **Skeleton Key** (`/skeleton-key`): full dark-theme rewrite (background-card / background-elevated tokens, text-white/text-text-secondary, border-rgba(255,255,255,0.07)). Added Admin → Skeleton Key breadcrumb and amber "Internal operator tool" chip. Amber CTA preserved as the privileged-action accent.
- **Quotes** filter rail: bare "?" pill replaced with labelled "? What do these mean?" pill; popover content unchanged.
- **Projects list rows**: inline View/Edit/Archive/Delete collapsed into a "•••" overflow popover (click-outside + Escape to close). Delete now opens a confirmation modal that requires typing the project name verbatim before the destructive button enables; modal supports Escape-to-close and restores focus to the trigger after close.

### Contacts as a First-Class Surface (May 2026)
- **Schema**: `phone` field added to `ClientContact`; new `ClientContactNote` model (activity/note log per contact, cascade delete)
- **Migration**: `20260502094304_add_contact_phone_and_notes` applied to Railway PostgreSQL
- **API**: `GET /api/contacts` (cross-client directory), `GET/DELETE /api/clients/:id/contacts/:contactId` (detail + delete), `POST/DELETE /api/clients/:id/contacts/:contactId/notes` (add/remove notes)
- **`/contacts` page**: searchable, filterable directory across all clients; split by approvers vs others; stat cards; links to detail panel
- **`ContactDetailPanel`**: slide-over with three tabs — Overview (edit name/email/phone/title/approver; delete with confirm), Notes (add/delete timestamped activity notes), Projects (linked projects with portal access status)
- **Sidebar**: Contacts added to DELIVERY nav group after Partners
- **ClientsWorkspace**: phone field added to "Add contact" form

### Ready State Pass (May 2026)
- **Navigation order**: DELIVERY (Projects, Clients, Partners) before SALES; Partners promoted to full-size nav item
- **Section renamed**: OPERATIONS → AUTOMATION (Portal Ops, Runs, Agents are HubSpot automation engine tools)
- **Footer label**: "Internal delivery workspace" → "Muloo Deploy OS"
- **Copy overhaul**: All page headers, descriptions, and workspace labels updated to accurately reflect platform purpose:
  - Projects: "HubSpot implementation, optimisation, and integration projects across all active clients"
  - Clients: "Companies Muloo is delivering HubSpot work for — implementation, optimisation, integration, or ongoing support"
  - Partners: "External delivery partners, agencies, and collaborators who receive structured briefs and execute work on behalf of Muloo clients"
  - Retainers: "Ongoing commercial agreements — monthly support, managed delivery, or fixed-scope commitments"
  - Portal Ops: eyebrow changed "Operations" → "Automation"
  - Inbox: "Work requests and messages" — "Incoming quote requests and change requests arrive here for triage, routing, and conversion to projects"
  - Agents: copy reflects HubSpot discovery extraction, blueprint generation, portal analysis
  - Settings: title "Settings", improved subtitle and team description
- **WorkRequestsInbox**: SkeletonRows loading, EmptyState zero-state, formatted status labels (capitalised, underscores → spaces)
- **InternalInbox**: Context-aware empty state message (project-filtered vs all messages)
- **Command Centre**: "Overdue invoices" label on invoice stat card (was just "Invoices"), SkeletonRows for Daily Signal loading state, empty state copy improved
- **Toast warnings**: `[useToast] used outside ToastProvider` scoped to dev-only

### Systematic UX Sweep (May 2026)
- `Breadcrumb.tsx` created — reusable page-level breadcrumb nav component
- `ProjectsDashboard` fully rewired: `useToast`, `SkeletonRows`, `EmptyState` + `FolderKanban` icon
- `ClientsWorkspace`: all async ops use `toast.success()` / `toast.error()`
- Delivery page nav cleaned; audit page breadcrumbs added
- Skeleton sweep across: `ProjectPrepareWorkspace`, `DiscoveryWorkspace`, `BlueprintWorkspace`, `ProjectOverview`, `ProjectEditWorkspace`, `PortalAuditWorkspace`

### Earlier Features
- **DB migration**: `executionTier` + `coworkInstruction` on `ExecutionJob`; `portalQuoteEnabled` on `Project`
- **AI assistant**: Live workspace context (active projects, clients, tasks, blocked counts)
- **Client portal rebuild**: Tab-based workspace (Overview / Tasks / Messages / Delivery), `ClientShell` nav
- **Portal quote toggle**: `portalQuoteEnabled` controls quote visibility in client portal
- **Message delete**: Operator and client-side message deletion
- **Delivery board client mode**: Hides internal execution details for `mode="client"`
- **Comms tab**: `ProjectMessagesPanel` for client-visible messages per project
- **Human QA review panel**: Agent output review with "Mark QA Passed" / "Send Back for Rework"
- **Portal audit model selector**: Full stack provider/model routing for audit engine
- **Operator portal preview**: 1-hour preview tokens; "Preview client portal →" in workspace

## T3 — Discovery model unification (Step A applied 2026-05-02)

- **Canonical session payload**: `DiscoverySubmission` (sessions). Step A (additive) absorbed `userId`, `sessionNumber`, `answers`, `legacyClientInputSubmissionId` from the legacy `ClientInputSubmission`.
- **Canonical workbook backing store**: `DiscoveryEvidence` with `kind="workbook"`. Distinct surface and shape from sessions — kept as a second canonical, deviation from the audit framing flagged for sign-off in the RUNBOOK.
- **Legacy duplicate**: `ClientInputSubmission` (0 rows). Step B will drop it after the soak.
- **Cutover flags** (both default to current behaviour):
  - `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES` (default `on`) — dual-write to legacy + canonical inside one `prisma.$transaction`.
  - `DISCOVERY_CANONICAL_READS` (default `off`) — all four read paths flip to canonical via `loadDiscoveryClientSubmissionsForRead` / `…ForReadWithUsers` helpers.
- **Canonical question categories**: 12 entries in `apps/web/app/components/questionLibraryConstants.ts` mirrored in `apps/api/src/discoveryQuestionCategories.ts` (drift filed as follow-up to move into `packages/shared`). Server validates on create + update.
- **Chase mechanics**: New workbooks default `dueDate` to **+5 business days** and `ownerName` to the project's **client champion**. Overdue rule: `dueDate < now()` AND any question still `status="unanswered"`. Surfaced on the Discovery tab and the Command Centre "What needs you" strip via `loadProjectDiscoveryOverdueSummary` / `loadOverdueDiscoverySummary`.
- **Boot seed**: `apps/api/src/index.ts` calls `ensureDeliveryTemplatesSeeded()` + `ensureWorkbookTemplatesSeeded()` at server boot (Promise.allSettled — failures log a warning, don't block boot). 5 default delivery templates + 4 default workbook templates ship in-tree; both seed functions upsert by stable identity (slug / title), safe on every boot.
- **Per-user uniqueness**: Migration `20260502230000_discovery_step_a_user_unique` adds a partial unique on `DiscoverySubmission(projectId, userId, sessionNumber) WHERE userId IS NOT NULL AND sessionNumber IS NOT NULL`. The live write path allocates `version` dynamically per project (above the synthetic floor of 1_000_000) so the existing `(projectId, version)` unique never collides across users.

See `apps/api/prisma/migrations/20260502210000_discovery_step_a_absorb_client_input/RUNBOOK.md` for the full inventory, the canonical-model decision (with the explicit sign-off note), and Step B prep.
