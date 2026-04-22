# Magnisol DeployOS Implementation Plan

## Goal

Turn the Magnisol enhancement direction into concrete changes inside the current `Muloo DeployOS` codebase.

This plan is intentionally biased toward the highest-value path:

1. improve the current project experience
2. avoid creating parallel concepts that fight the current model
3. reuse the existing questionnaire, audit, delivery board, template, and retainer systems
4. add only the minimum new data structures needed to make the flow coherent

## Product stance

The right move is not to create a new app or a new project system.

The right move is to make the current project lifecycle in DeployOS stronger for a client delivery shape where one project contains:

- discovery
- implementation
- website delivery
- agent-assisted setup
- audit and hygiene outputs
- project-level hour tracking

## Key implementation decision

### Keep the existing 4-session discovery model

Do not expand the client questionnaire into a new free-floating intake framework first.

Instead:

- keep sessions `1-4`
- enrich the question sets inside those sessions
- add new questions for portal optimisation, website, data hygiene, and standard property needs
- use `assignedInputSections` and project questionnaire config more intentionally

Why:

- current API and UI already assume sessions `1-4`
- `normalizeClientQuestionnaireConfig()` in [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts) is hard-coded around `1..4`
- the client workspace, project inputs workspace, and discovery workspace are already built around this shape

This is the fastest route to real product improvement.

### Add first-class task-to-workstream linking

This is the most important data model improvement.

`Project.deliveryWorkstreams` already exists, but `Task` does not yet carry a `workstreamId`.

Without that:

- hours cannot roll up properly by Discovery / Implementation / Website
- audit findings cannot map neatly into workstreams
- the delivery board cannot become the execution layer for a multi-workstream project

Recommended additions to `Task`:

- `workstreamId String?`
- `taskOrigin String?`
- `producedBy RetainerProducedBy?` or a project-level equivalent if you want to avoid coupling directly to retainer semantics

## Highest-value build sequence

## Phase 1: Make current project views reflect the real delivery shape

### Outcome

The project overview, delivery board, and inputs workspace should visibly support:

- three workstreams
- better client input coverage
- clearer hours
- stronger audit-to-action handoff

### Files

- [apps/web/app/components/ProjectOverview.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectOverview.tsx)
- [apps/web/app/components/ProjectInputsWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectInputsWorkspace.tsx)
- [apps/web/app/components/clientQuestionnaire.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/clientQuestionnaire.ts)
- [apps/web/app/components/DeliveryBoard.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/DeliveryBoard.tsx)
- [apps/web/app/components/PortalAuditWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/PortalAuditWorkspace.tsx)

### Specific changes

#### Project overview

Add cards or sections for:

- `Workstreams`
- `Hours`
- `Standard Pack Status`
- `Client Input Coverage`
- `Audit & Hygiene`

Use existing data first:

- `project.deliveryWorkstreams`
- `taskBoard.columns`
- `findings`
- `portalSnapshot`
- `latestClientSubmissionAt`

Short-term implementation trick:

- calculate workstream rollups client-side from tasks once `workstreamId` exists
- before that field exists, fall back to a lightweight heuristic using task category or title prefixes only if needed

#### Questionnaire

Extend [apps/web/app/components/clientQuestionnaire.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/clientQuestionnaire.ts) with new default questions such as:

- Session 1: portal optimisation goals, success measures, website outcomes
- Session 2: data hygiene issues, duplicated tools, reporting gaps
- Session 3: standard property needs, website lead capture requirements, regional variants
- Session 4: what the client wants to self-manage, launch blockers, ownership and handover

Do not change the session count yet.

#### Project inputs workspace

Enhance [apps/web/app/components/ProjectInputsWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectInputsWorkspace.tsx) to make the questionnaire config feel less generic.

Add:

- named presets for `Magnisol-style portal delivery`
- section assignment helpers like `Business`, `Current State`, `Website`, `Data Hygiene`, `Handover`
- summary chips showing which extra question groups are enabled

#### Delivery board

Enhance [apps/web/app/components/DeliveryBoard.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/DeliveryBoard.tsx) to:

- show hours by workstream
- filter by workstream
- show task origin
- keep the existing planned vs actual pattern

#### Portal audit

Enhance [apps/web/app/components/PortalAuditWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/PortalAuditWorkspace.tsx) so findings can be routed into workstreams and then into tasks.

Add:

- `Suggested workstream`
- `Create task`
- `Create quick win task`
- `Include in standard pack`

## Phase 2: Add the minimum backend data model to support workstreams properly

### Outcome

Tasks, findings, and project summaries can roll up cleanly by Discovery / Implementation / Website.

### Files

- [apps/api/prisma/schema.prisma](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/prisma/schema.prisma)
- [apps/api/prisma/migrations](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/prisma/migrations)
- [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts)
- [apps/api/src/app.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/app.ts)

### Recommended schema changes

Add to `Task`:

- `workstreamId String?`
- `taskOrigin String?`
- `producedBy RetainerProducedBy?` or `String?` if you want looser coupling

Optional but useful on `Project`:

- `standardPackStatus Json?`
- `hygieneSummary Json?`
- `seededAssetsSummary Json?`

Why these are worth it:

- `workstreamId` unlocks board filtering and hour rollups
- `taskOrigin` explains whether a task came from audit, questionnaire, template, or manual creation
- `producedBy` makes agent vs human effort visible
- the project JSON summaries let the overview render useful state without expensive recomputation

### Backend changes

Update task create/update flows in [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts):

- `createProjectTask()`
- `updateProjectTaskRecord()`
- `serializeTask()`
- `loadProjectTaskBoard()`

Update API handlers in [apps/api/src/app.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/app.ts):

- `POST /api/projects/:projectId/tasks`
- `PATCH /api/projects/:projectId/tasks/:taskId`
- any route that creates tasks from findings or templates

## Phase 3: Build the one-click standard pack

### Outcome

An operator can take a project in its current shape and seed a standard Muloo foundation into it with one action.

### Best fit in the existing product

Do not put this in project creation first.

The better place is:

- project overview
- project prepare workspace
- or portal ops section on the project

That lets the operator review context before applying it.

### Files

- [apps/web/app/components/ProjectOverview.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectOverview.tsx)
- [apps/web/app/components/ProjectPrepareWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectPrepareWorkspace.tsx)
- [apps/api/src/app.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/app.ts)
- [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts)
- [data/templates](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/data/templates)

### New endpoint

Recommended endpoint:

- `POST /api/projects/:projectId/seed-standard-pack`

Recommended payload:

- requested workstreams
- whether to include audit queueing
- whether to include CMS starters
- whether to seed task templates immediately

### Recommended seed behavior

1. Ensure default workstreams exist.
2. Apply or enrich questionnaire config with the Magnisol-style additions.
3. Seed standard property planning into project metadata or standards data.
4. Queue portal audit if the project has a connected portal.
5. Create starter tasks using existing template/task creation flow.
6. Save `standardPackStatus` and `seededAssetsSummary` back to project.

### Reuse paths already in the product

Do not build a second templating system.

Reuse:

- [data/templates/muloo-revops-foundation.json](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/data/templates/muloo-revops-foundation.json)
- [data/templates/muloo-sales-foundation.json](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/data/templates/muloo-sales-foundation.json)
- [data/templates/muloo-service-foundation.json](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/data/templates/muloo-service-foundation.json)
- existing delivery template loading via `loadProjectTaskTemplates()`

Recommendation:

- add one new foundation template or a composition layer for a `portal + website` standard pack
- avoid putting all standard-pack logic directly in the frontend

## Phase 4: Convert audit and questionnaire signals into delivery work

### Outcome

The current portal audit and client questionnaire stop being passive context and start driving execution.

### Files

- [apps/web/app/components/PortalAuditWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/PortalAuditWorkspace.tsx)
- [apps/web/app/components/ProjectInputsWorkspace.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectInputsWorkspace.tsx)
- [apps/web/app/components/DeliveryBoard.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/DeliveryBoard.tsx)
- [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts)

### Recommended additions

#### From findings to tasks

Add a helper flow:

- finding -> suggested workstream -> suggested task -> created task

This can be done with:

- a button in `PortalAuditWorkspace`
- a backend helper that calls `createProjectTask()`

#### From questionnaire to starter tasks

Add a backend helper that reads:

- discovery summary
- questionnaire answers
- selected hubs
- workstreams

and creates starter tasks when certain conditions appear.

Examples:

- website conversion issue -> implementation or website task
- lifecycle confusion -> implementation task
- reporting gap -> implementation task
- poor data hygiene -> discovery or implementation task depending on readiness

## Phase 5: Make hours commercially useful in the current experience

### Outcome

The existing task hour model becomes meaningful at project and workstream level.

### Files

- [apps/web/app/components/DeliveryBoard.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/DeliveryBoard.tsx)
- [apps/web/app/components/ProjectOverview.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectOverview.tsx)
- [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts)
- [apps/api/src/retainers.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/retainers.ts)

### Specific changes

#### Delivery board metrics

Current board metrics already calculate planned and actual hours.

Improve them to show:

- by workstream
- by assignee type
- by produced-by type
- linked retainer impact when a retainer is attached

#### Project overview metrics

Add:

- total planned hours
- total actual hours
- variance
- Discovery / Implementation / Website split
- human vs agent effort

#### Billing alignment

Do not build invoicing logic first.

First get the project-level and workstream-level hours right.

Then connect them more tightly to the retainer ledger and `approve-to-bill` flow.

## Phase 6: Improve agent visibility, not just agent capability

### Outcome

Operators can see where agents helped and where human review is still required.

### Files

- [apps/web/app/components/DeliveryBoard.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/DeliveryBoard.tsx)
- [apps/web/app/components/ProjectOverview.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/ProjectOverview.tsx)
- [apps/web/app/components/AIAssistantPanel.tsx](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/web/app/components/AIAssistantPanel.tsx)
- [apps/api/src/server.ts](/Users/jarrudvandermerwe/Work/03%20Projects/Muloo-DeplyOS/apps/api/src/server.ts)

### Specific changes

Show for each task:

- `Agent-assisted`
- `Agent-runnable`
- `Last run output`
- `Needs review`

Show on overview:

- count of agent-linked tasks
- latest agent run summary
- estimated agent-saved effort once `producedBy` is available

## Recommended first implementation PR

The best first PR is not the one-click standard pack.

The best first PR is:

1. add `workstreamId` and `taskOrigin` to tasks
2. enrich default questionnaire questions
3. update overview and delivery board to roll up by workstream
4. add finding-to-task creation with workstream selection

Why this first:

- it improves current operator value immediately
- it strengthens the current portal without a big new orchestration layer
- it creates the foundation the one-click standard pack will need

## Recommended second implementation PR

1. add `seed-standard-pack` backend endpoint
2. add UI action on project overview or prepare workspace
3. seed questionnaire config, starter tasks, and status summaries
4. queue portal audit when applicable

## Recommended third implementation PR

1. add richer hours rollups and produced-by visibility
2. connect standard pack outputs to overview cards
3. show stronger client input coverage and readiness state

## Risks to avoid

- do not create a second questionnaire system
- do not create a separate website project abstraction unless absolutely necessary
- do not put too much seed logic only in the frontend
- do not delay workstream-aware task modeling if hours matter
- do not make the first iteration dependent on perfect automation

## Bottom line

The highest-leverage change for Magnisol-style delivery is to make the current project flow in DeployOS genuinely workstream-aware, then let audit, inputs, and standard packs flow through that structure.

If we do that in the order above, the current portal becomes much more capable without forcing a rewrite or a new app concept.
