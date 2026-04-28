# Sprint 07: UX Redesign — Layout, Navigation, and Command Centre

**Status:** Ready for implementation
**Priority:** P0 — platform goes live for delivery next week
**Estimated effort:** 3–4 days
**Depends on:** Nothing blocking
**Authored:** 26 Mar 2026

---

## The Core Problem

The current app stacks everything vertically in one enormous scrollable component (ProjectOverview.tsx is 5,115 lines). Every section is a collapsible panel. Users have to scroll and open/close to find anything.

No best-in-class tool does this. Linear, HubSpot, Intercom, Notion — all of them use one of two patterns for detail pages with many sections:
- **Tabs** (GitHub, HubSpot CRM records, Intercom conversations)
- **Two/three column layout** (Linear issues, Notion, Intercom)

The fix is not cosmetic. It's structural.

---

## Design Principles for This Redesign

1. **Show the most important thing first, always.** Don't make users scroll to find status, actions, or client info.
2. **Group by job to be done, not by data type.** Don't put all "discovery" data together just because it's discovery — put it where users need it when they're doing that job.
3. **AI tools are actions, not sections.** Email and agenda are things you do, not things you read. They belong in an action panel, not in the page scroll.
4. **The command centre is for decisions, not for everything.** Show what needs attention today — not every project, run, and template.
5. **Reduce chrome, increase signal.** Every label, border, card, and header that doesn't carry information should be removed.

---

## Part 1: Global Navigation Redesign

### Current sidebar groups (implicit):
Workspace, Delivery, Operations, Admin — but not clearly delineated.

### New sidebar structure:

```
━━━━━━━━━━━━━━━━
  MULOO
━━━━━━━━━━━━━━━━

  ⌂  Command Centre       (/)
  📥  Inbox               (/inbox)

  ── DELIVERY ──────────

  📁  Projects            (/projects)
  👥  Clients             (/clients)

  ── OPERATIONS ─────────

  ⚡  Portal Ops          (/projects/portal-ops)
  🔄  Runs                (/runs)
  🤖  Agents              (/agents)

  ── ADMIN ──────────────

  📋  Templates           (/templates)
  ⚙️  Settings            (/settings)

━━━━━━━━━━━━━━━━
  Internal Delivery
  Workspace
━━━━━━━━━━━━━━━━
```

### Changes from current:
- Remove `Operations Hub` as a separate page — it's just a card grid linking to things already in the sidebar. Redundant. Delete it or redirect to `/runs`.
- Add section dividers with labels (DELIVERY, OPERATIONS, ADMIN) for visual grouping
- `Command Centre` replaces the current home page (which is just a projects list)
- Keep `Internal Delivery Workspace` label at the bottom

---

## Part 2: Command Centre Redesign

### Current state:
The home page (`/`) just renders `ProjectsDashboard` — a list of all projects. That's a projects page, not a command centre.

### New Command Centre layout:

```
┌─────────────────────────────────────────────────────────┐
│  Good morning, Jarrud.  Thursday 26 Mar                  │
├────────────┬────────────┬────────────┬──────────────────┤
│ 4          │ 2          │ 1          │ 3                 │
│ Active     │ Awaiting   │ Overdue    │ Runs queued       │
│ projects   │ client     │ task       │                   │
├────────────┴────────────┴────────────┴──────────────────┤
│  NEEDS ATTENTION                                         │
│                                                          │
│  ⚠ EPIUSE ZA · Dashboard due today · HubSpot Fnd Ph2   │
│  ⏳ Africa · Awaiting client input · 3 days waiting     │
│  ✅ Muloo · Blueprint approved · ready to deliver       │
│                                                          │
├─────────────────────────┬───────────────────────────────┤
│  ACTIVE PROJECTS        │  RECENT RUNS                  │
│                         │                               │
│  EPIUSE ZA              │  Portal Audit · EPIUSE ZA     │
│  HubSpot Foundation P2  │  Complete · 26 Mar 11:05      │
│  In-flight · Sales+Svc  │                               │
│                         │  Dashboard Build · EPIUSE ZA  │
│  Africa                 │  Queued · 26 Mar 10:48        │
│  CRM Cleanup            │                               │
│  Scoping · Data Mgmt    │  Property Apply · EPIUSE ZA   │
│                         │  Failed · 26 Mar 09:12        │
│  [View all projects →]  │  [View all runs →]            │
└─────────────────────────┴───────────────────────────────┘
```

### Implementation:

**File:** `apps/web/app/components/MulooCommandCentre.tsx` (already exists — redesign it)

**Data to fetch on load:**
```typescript
// Stat cards
GET /api/projects?status=in-flight&count=true        // active projects
GET /api/projects?status=awaiting_client&count=true  // awaiting client
GET /api/tasks?overdue=true&count=true               // overdue tasks
GET /api/execution-jobs?status=queued&count=true     // queued runs

// Needs attention — smart list
// Logic: projects where (task.overdue OR status=awaiting_client OR blueprint_approved_no_delivery)
// Return top 5, ordered by urgency

// Active projects — top 6 by lastUpdated
// Recent runs — last 5 execution jobs with status + project name
```

**Stat card component:**
```tsx
<StatCard
  value={4}
  label="Active projects"
  status="neutral"  // neutral | warning | danger
  href="/projects?filter=active"
/>
```

**Needs Attention items:**
Each item shows: project name · reason · age of the issue. Click navigates to the project. Colour-coded by urgency (red = overdue, amber = waiting, green = ready to act).

**No pagination on command centre.** Limit everything — top 5 attention items, top 6 projects, last 5 runs. Links to full lists for overflow.

---

## Part 3: Project Detail Page Redesign

This is the biggest change. Replace the single scrolling page with a two-column + tab layout.

### New layout structure:

```
┌──────────────────────────────────────────────────────────┐
│ ← Back to projects                                        │
│                                                           │
│ HubSpot Foundation Phase 2          [Draft ▼]  [Actions] │
│ EPIUSE ZA · Optimisation · Sales Hub Pro · Service Hub   │
├──────────────────────────────────────────────────────────┤
│ [Overview] [Discovery] [Plan] [Delivery] [Comms] [Portal]│
├────────────────────────┬─────────────────────────────────┤
│                        │                                  │
│   TAB CONTENT          │   CONTEXT SIDEBAR                │
│   (main area)          │   (always visible)               │
│                        │                                  │
└────────────────────────┴─────────────────────────────────┘
```

### Right context sidebar (always visible, never tabs):
This replaces the "Project Context" collapsible. It's always there, never hidden.

```
CLIENT
EPIUSE ZA
jac.mare@epiuse.com

PORTAL
www.epiuse.com
Hub tier: STANDARD
● Connected

SNAPSHOT
Contacts 394
Deals 104
Properties 194 / Custom 12

OWNER
Jarrud van der Merwe

HUBS IN SCOPE
Sales   Service

PLATFORM
Pragmatic / POC
Professional customer platform

QUICK WINS
4 total · 4 open · 0 resolved

[Refresh Snapshot]
```

Width: `w-72` (288px), fixed, non-scrolling relative to tab content.

### Tab 1: Overview
**Left main area content:**
- Project status card (type, phase, last updated)
- Human inputs summary (how many answered vs total)
- Blueprint status (generated / not generated, link if generated)
- Agent summary (risks, tools, recommendations — from discovery)
- Quick wins list (expandable, show/resolve inline)

### Tab 2: Discovery
- Q&A sessions tracker (4 sessions, completion status)
- Discovery progress bar
- `[Open Discovery →]` button linking to `/projects/[id]/discovery`
- Prepare notes preview with `[Open Prepare →]` link

### Tab 3: Plan
- Blueprint status + `[View Blueprint →]` / `[Generate Blueprint]`
- Scope & approval status
- `[Open Quote →]` / `[Open Proposal →]` buttons
- Working doc link

### Tab 4: Delivery
- Open tasks count + status breakdown
- `[Open Delivery Board →]` as primary CTA
- Change management summary (open work requests)
- `[View Changes →]` link

### Tab 5: Comms
Replace the current stacked email + agenda sections with a proper two-panel layout:

```
┌────────────────────┬─────────────────────────────────┐
│  EMAIL DRAFT       │  AGENDA BUILDER                  │
│                    │                                  │
│  [textarea]        │  Session type: [dropdown]        │
│                    │  Date: [input]                   │
│                    │  Duration: [dropdown]            │
│                    │  Focus notes: [input]            │
│                    │                                  │
│  [Voice] [Draft]   │  [Generate Agenda]               │
│  [Copy]            │                                  │
│                    │  ── Generated agenda ──          │
│                    │  [agenda output]                 │
│                    │  [Copy agenda]                   │
└────────────────────┴─────────────────────────────────┘
```

Email and agenda sit side by side — not stacked. Equal width columns.

**Agenda builder improvements:**
- Add "Save as template" button — saves the generated agenda as a named template for reuse
- Add session history — last 3 generated agendas shown as collapsed items below the generator, each with the session type, date, and a "Copy" button
- When a date is entered, show a `[+ Add to Calendar]` button that creates a Google Calendar event with the agenda as the description (uses the gcal MCP)

### Tab 6: Portal
- Client portal user management (invite, reset, access control)
- Portal Ops quick actions
- HubSpot portal connection status

---

## Part 4: Runs Page Redesign

### Current state:
All runs on one page, two sections (workflow runs + agent runs), no grouping.

### New layout:

```
┌──────────────────────────────────────────────────────────┐
│  Execution Runs                        [+ New run]       │
│                                                          │
│  [All] [Queued] [Running] [Complete] [Failed]            │
│                         Search: [_______________]        │
├──────────────────────────────────────────────────────────┤
│  TODAY                                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ● Portal Audit · EPIUSE ZA  Complete  11:05 AM   │   │
│  │   View output →                                   │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⏳ Dashboard Build · EPIUSE ZA  Queued  10:48 AM  │   │
│  │   Cancel                                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  YESTERDAY                                               │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

**Key changes:**
- Filter tabs at top: All / Queued / Running / Complete / Failed
- Group by day (Today, Yesterday, This week)
- Each run is a single row — not an expanded card by default
- Click to expand and see output log, error log, and cowork instruction
- Add search by project name or module key
- Remove the distinction between "workflow runs" and "agent runs" at the list level — merge into one feed, show the type as a badge
- Pagination: 20 per page

---

## Part 5: Portal Ops Improvements

The Portal Ops page is already good but needs small improvements:

1. **Show portal health badge** next to the connected portal selector — green (connected), amber (snapshot stale), red (disconnected)
2. **Recent runs list** on the right panel — last 5 runs for the selected portal with status badges
3. **Capability chips** — after request is submitted, show the detected capability as a chip (e.g. `dashboards_and_reporting`) before the execution path loads
4. **Execution tier badge** — show which tier was used (API / Browser Session / Cowork / Manual) on each result

---

## Part 6: Agenda Builder Enhancements

Beyond what's in the tab layout (Part 3), improve the agenda tool itself:

**Session history:** Store last 3 generated agendas per project in `project.agendaHistory` (array of `{ sessionType, date, generatedAt, content }`). Show them as collapsed rows below the generator.

**Save as template:** Button to save a generated agenda structure (without the specific project details) to the Templates library, so it can be reused across projects. Calls `POST /api/templates` with `{ type: 'agenda', sessionType, content }`.

**Add to calendar:** When a date is set, show `[+ Add to Google Calendar]`. On click:
- Create a calendar event via gcal MCP: title = `{sessionType} — {clientName}`, description = the agenda content, date/time from the input
- Show confirmation: "Event created ✓"

**Smart duration suggestions:** When session type is selected, pre-fill duration:
- Workshop/Onboarding → Full day
- Discovery → 2hrs
- Kick-off → 1hr
- Check-in → 30min

---

## Part 7: Component Breakdown (ProjectOverview.tsx)

The 5,115-line monolith must be split into focused components. This is required for Sprint 07 to work.

### New component structure:

```
apps/web/app/components/project/
├── ProjectDetailLayout.tsx       # Top bar + tab nav + two-column layout shell
├── ProjectContextSidebar.tsx     # Right sidebar (always visible context)
├── tabs/
│   ├── OverviewTab.tsx           # Tab 1
│   ├── DiscoveryTab.tsx          # Tab 2
│   ├── PlanTab.tsx               # Tab 3
│   ├── DeliveryTab.tsx           # Tab 4
│   ├── CommsTab.tsx              # Tab 5 — email + agenda side by side
│   └── PortalTab.tsx             # Tab 6
├── comms/
│   ├── EmailComposer.tsx         # Simplified email composer
│   └── AgendaBuilder.tsx         # Agenda builder with history + calendar
└── shared/
    ├── QuickWinsList.tsx         # Quick wins (used in Overview tab + sidebar)
    ├── ProjectStatBadge.tsx      # Status badge used throughout
    └── SectionHeader.tsx         # Consistent section title + action pattern
```

The existing `ProjectOverview.tsx` becomes a thin wrapper that imports `ProjectDetailLayout` and passes the project data down. All logic moves into the sub-components.

---

## Implementation Instructions for Codex

### File reading order before starting:
1. `apps/web/app/components/ProjectOverview.tsx` — understand all sections and their state
2. `apps/web/app/components/MulooCommandCentre.tsx` — understand current command centre
3. `apps/web/app/runs/page.tsx` — understand current runs page
4. `apps/web/app/components/AppShell.tsx` — understand sidebar structure
5. `apps/web/app/components/Sidebar.tsx` — understand nav items
6. `apps/api/src/app.ts` — check which API endpoints exist for the command centre stat cards

### Build order:
1. **Sidebar nav** — add section dividers, reorder groups, remove Operations Hub redundancy
2. **Command Centre** — rebuild MulooCommandCentre.tsx with stat cards, attention list, project cards, recent runs
3. **ProjectDetailLayout + tabs** — create the new layout shell and 6 tabs (move existing section content into tabs, don't rewrite logic yet)
4. **ProjectContextSidebar** — extract the context data from ProjectOverview into the persistent sidebar
5. **CommsTab** — side-by-side email + agenda layout with agenda improvements
6. **Runs page** — add filter tabs, group by day, merge run types, add pagination
7. **Portal Ops** — add portal health badge, recent runs list, execution tier badge

### Tailwind CSS conventions to follow:
- Dark theme: `bg-zinc-900`, `bg-zinc-800`, `bg-zinc-700` for layering
- Text: `text-white`, `text-zinc-300`, `text-zinc-500`
- Borders: `border-zinc-700`, `border-zinc-800`
- Accent: check existing components for the purple/violet accent colour used
- Tabs: use `border-b border-zinc-700` with active tab as `border-b-2 border-violet-500 text-white`
- Sidebar width: `w-72` for context sidebar, sticky with `sticky top-0 h-screen overflow-y-auto`

### Do NOT break these things:
- All existing API calls in ProjectOverview must continue to work
- The workflow nav bar at the top of project sub-pages (discovery, delivery, etc.) should remain unchanged
- Client portal routes are completely separate — do not touch `/client/*`
- Auth logic in AppShell and AuthGate must not be modified

### Key constraint:
This is a **layout and component reorganisation**, not a feature rewrite. Move existing code into the new structure. Don't rewrite business logic. The goal is that everything that works today still works — just in a better layout.

---

## PR Checklist

- [ ] `pnpm build` passes (TypeScript + Next.js)
- [ ] Sidebar has section dividers and correct grouping
- [ ] Command centre shows stat cards, attention items, active projects, recent runs
- [ ] Project detail uses tab layout with 6 tabs
- [ ] Context sidebar is persistent (not a collapsible section)
- [ ] Comms tab has email + agenda side by side
- [ ] Agenda builder shows session history (last 3)
- [ ] Agenda builder has "Add to Calendar" button
- [ ] Smart duration pre-fill on session type selection
- [ ] Runs page has filter tabs and day grouping
- [ ] No TypeScript errors
- [ ] All existing project functionality still works (don't break discovery, delivery, quote etc.)
- [ ] Mobile is not a requirement for this sprint — optimise for 1280px+ desktop only
