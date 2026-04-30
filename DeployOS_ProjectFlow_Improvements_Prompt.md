# DeployOS — Project Flow Improvements (Codex Prompt)

> **Codex role:** Senior product engineer + systems architect. You're closing the gap between DeployOS as a working PM tool and DeployOS as a CRM-grade delivery platform. Treat the comparator points to HubSpot, Monday.com, Proposify and PandaDoc as design constraints, not aspirations.

## Strategic context

DeployOS already has a Delivery Board with execution tiers, planned hours and validation states. What's missing is the connective tissue that makes a portfolio of projects manageable at 10+ active engagements: dependencies between tasks, project health at a glance, milestones as first-class citizens, an activity log per project, and portal data inheritance so operators don't keep retyping the same context.

Each task below ships independently. Pick them up in priority order.

## Out of scope

- Time tracking MVP (separate sprint, not in this prompt set yet — flag if encountered).
- Quote flow and client portal — see their own prompt files.
- Production hardening — see its own prompt file.

---

## Improvement 1 — Task dependencies (UI for an existing schema field)

**Schema reality:** `Task.dependencyIds String[]` already exists at `apps/api/prisma/schema.prisma:736`. Backend is half-built. UI is missing.

**Comparator:** Monday.com's Dependencies column is the gold standard for visual dependency management. ClickUp's "blocked by / blocking" panel is similar.

### Backend completion

1. Audit `apps/api/src/server.ts` for any function that reads/writes `dependencyIds`. If absent, add:
   - `setTaskDependencies(taskId, dependencyIds[])` — validates no cycles, validates same-project only.
   - `loadTaskDependencyGraph(projectId)` — returns `{ tasks: Task[], edges: {from, to}[] }`.
2. Routes (in `apps/api/src/app.ts`):
   - `PUT /api/tasks/:taskId/dependencies` — body: `{ dependencyIds: string[] }`.
   - `GET /api/projects/:projectId/dependency-graph`.
3. Validate Zod schema for both. Cycle detection via DFS on the existing graph.

### UI

Two surfaces:

**A) Per-task drawer.** On any task row in the Delivery Board, the drawer (or modal) gets a "Blocked by" multi-select. Searchable, can pick any task in the project. Saving updates `dependencyIds`. Dependencies show as small pills with task title and status colour.

**B) Project dependency graph.** New tab: `Project → Dependencies` (or a Delivery Board view toggle "Graph"). Renders the graph using a lightweight lib (recommend `reactflow` or `dagre` — keep bundle small). Nodes = tasks, edges = dependency. Status colour-coded.

### Behaviour rules

- A task with **incomplete blockers** shows a 🔒 icon on its Delivery Board card and cannot transition to `in_progress`.
- When all blockers complete, fire a `ProjectMessage`-style notification (or just an unread Inbox item) for the assignee.

### Acceptance

- Cycle attempt returns 400 with `"Adding this dependency would create a cycle: A → B → A"`.
- Task with unmet blockers cannot start (UI button disabled with tooltip, API rejects status change).
- Graph renders for a project with 10+ tasks and 5+ dependencies in under 200ms.

---

## Improvement 2 — Project health score

**Comparator:** HubSpot's deal health score, Asana's project health flags (on-track / at-risk / off-track), ClickUp's project status with reasons. The Asana model is the right shape for DeployOS — a categorical health with a system-suggested value plus optional operator override.

### Schema

Add to `Project` model:

```prisma
healthStatus       String?   // "on_track" | "at_risk" | "off_track" | null
healthReason       String?   // operator note when overriding
healthLastReviewedAt DateTime?
```

Migrate. (Don't add an enum; keep as string with a constants file at `apps/api/src/projectHealth.ts`.)

### Computation

System suggested value derived in `loadProjectHealthSuggestion(projectId)`:

| Signal | Weight | Threshold |
|---|---|---|
| % tasks past planned hours | High | >25% over → at_risk; >50% over → off_track |
| Days since last client message | Medium | >14 → at_risk; >30 → off_track |
| Open blockers (tasks with unmet dependencies and "in_progress" attempts) | Medium | >0 → at_risk |
| Days past target completion (if set) | High | >0 → at_risk; >14 → off_track |
| Approval queue age (oldest pending approval) | Medium | >7 days → at_risk; >14 → off_track |

Sum signals to a category. Operator can override on the project page; override stores `healthStatus` + `healthReason` + `healthLastReviewedAt = now()`.

### UI

- Project page header: large pill (green/amber/red) with the status. Clickable → drawer showing each signal's contribution + operator override form.
- Command Centre: existing tiles get a fourth alongside Live/In delivery/Awaiting approval/Blocked external — **At risk** count.
- Project list (`/projects`): health pill in each row. Filter chips: All / On track / At risk / Off track.

### Acceptance

- Loading a project with no manual override shows the auto-computed health.
- Manual override persists across reloads and is shown with a "Reviewed by Jarrud · 2d ago" hint.
- The "At risk" Command Centre tile counts match what's in `/projects?health=at_risk`.

---

## Improvement 3 — Milestones as first-class citizens

**Current state:** The schema has Phases (via `DeliveryTemplate` and grouping in `Task.workstreamId`-style fields) but no explicit milestones with target dates and client-visible status.

**Comparator:** Monday.com milestones (diamond-shape on timeline), Asana milestones, Proposify "Phases & Milestones" in proposals. The right model: milestone = named anchor with a target date, optional ownership, and a derived state from its associated tasks.

### Schema

```prisma
model Milestone {
  id             String    @id @default(cuid())
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title          String
  description    String?
  targetDate     DateTime
  completedAt    DateTime?
  status         String    @default("upcoming")  // upcoming | in_progress | completed | missed
  orderIndex     Int       @default(0)
  taskIds        String[]  // tasks rolled up under this milestone
  clientVisible  Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([projectId, targetDate])
}
```

### Logic

- `recomputeMilestoneStatus(milestoneId)` — runs whenever a `taskIds` task changes status:
  - All tasks complete → `completed`, set `completedAt`.
  - Any task in_progress, today < targetDate → `in_progress`.
  - Today > targetDate, not completed → `missed`.
  - Else `upcoming`.

### UI

- **Project workspace landing:** new "Milestones" cluster between Delivery and Quote. Shows next 3 upcoming milestones with countdown ("Discovery review · in 4 days").
- **Project → Milestones tab:** full CRUD. Drag tasks onto milestones. Drag milestones to reorder.
- **Client portal:** milestones (where `clientVisible=true`) appear on the Delivery tab in a horizontal timeline (the existing 3 tiles for "Currently working on / Progress / Waiting on" stay; milestones go above as a strip).

### Acceptance

- Add 3 milestones to a project, link tasks, watch statuses recompute as task statuses change.
- Client portal shows only milestones with `clientVisible=true`.
- Missing a target date flips status to `missed` automatically (cron or on-read).

---

## Improvement 4 — Project activity log

**Schema reality:** `AuditLog` model already exists (`schema.prisma:947`). It's underused. Most events that should land there don't.

**Comparator:** HubSpot's deal timeline, Asana's project conversation log, Linear's activity feed. The HubSpot model — a unified timeline of every event with filters — is what to build.

### Hook coverage

Audit every domain function that mutates a project-scoped entity (`Task`, `ProjectQuote`, `Retainer`, `Invoice`, `Milestone`, `ClientPortalUser`, `ClientProjectAccess`, `Finding`, `Recommendation`, `WorkflowRun`, `ProjectMessage`). For each, append an `AuditLog` row with:

```ts
await writeAuditLog({
  projectId,
  actorId: user.id,
  actorType: "operator" | "client" | "system" | "agent",
  entityType: "Task",
  entityId: task.id,
  action: "status_changed",
  payload: { from: prev.status, to: next.status },
});
```

Centralise via a `withAudit(handler)` helper or a Prisma middleware extension — Prisma's `$extends` is fine here.

### UI

- **Project → Activity tab.** Reverse-chronological feed grouped by day. Filter chips: All / Tasks / Quotes / Approvals / Messages / Agents / System. Search box for actor name.
- **Sidebar widget on project landing:** last 5 events with "View all" link.

### Client-facing slice

A reduced version (`Activity → Client view toggle`) shows only events with `clientVisible=true`. Use the same model as milestones — a flag per event type. Approvals, milestones, deliveries are visible; internal status churn isn't.

### Acceptance

- Mutating any of the listed entities writes an `AuditLog` row.
- Activity tab renders 100+ events smoothly with virtualised list.
- Client view shows the curated subset only.

---

## Improvement 5 — Portal auto-inherit on project creation

**Symptom:** Creating a project for an existing client doesn't pre-fill known portal context (HubSpot portal id, brand config, default partner billing model, prior service-line patterns). Operators retype.

**Schema reality:** `Client.hubSpotPortalId` exists, `HubSpotPortal` model exists, `Project.portalId` ties them.

### Logic

In the project creation handler (`apps/api/src/app.ts` — grep `POST /api/projects` and `createProject`):
1. If `clientId` is set and `Client.hubSpotPortalId` is set, default `Project.portalId` to that.
2. Default `includesPortalAudit` to `true` if portal is set.
3. Pull the client's most recent project of the same `engagementType` and surface it as a "Use these defaults" option in the wizard:
   - service line (HubSpot Architecture / Custom Engineering / AI Automation)
   - billing model
   - target completion ETA pattern (e.g. average duration of last N projects of same type for this client)
   - relevant `BillToEntity` if multi-entity client.

### UI

- Wizard Step 2 gets a top banner when a previous project exists for this client + engagement type:
  > _Last "HubSpot Architecture" project for **Magnisol** completed in 28 days. Use the same setup?_  
  > [ Use last setup ]   [ Start fresh ]

- Selecting "Use last setup" pre-fills the relevant fields, all editable. No silent inheritance.

### Acceptance

- New project for a client with prior history auto-suggests; operator can accept or override.
- New project for a brand-new client uses defaults from the workspace config (existing path).

---

## Sequencing

Recommended order:
1. **Task dependencies** (small, schema already in place, big visible win).
2. **Activity log** (foundational — milestones and health benefit from it).
3. **Milestones** (depends on dependencies for the rollup).
4. **Health score** (uses milestones and activity log signals).
5. **Portal auto-inherit** (independent, can ship anytime).

## Final acceptance

After all five land:
- A project page shows: header pill (health), milestones strip, dependency-aware delivery board, activity tab.
- A client opening their portal sees the milestones, the curated activity, the next-up indicator.
- Command Centre's "At risk" tile reflects real signals.
- Creating a new project for an existing client cuts wizard time in half.
