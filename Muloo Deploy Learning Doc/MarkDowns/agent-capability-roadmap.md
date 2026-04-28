# Muloo DeployOS — Agent Capability Roadmap
*What the platform needs to actually do the work*

---

## The honest gap

Right now DeployOS is a **smart project management tool** with some AI generation bolted on. It tracks delivery, stores context, drafts emails, and can run a few HubSpot read operations. That's useful — but it's not what the diagram is describing.

The diagram describes a platform where agents **execute the work**: create HubSpot config, build workflows, audit portals, update clients, suggest what to do next. The gap is the execution layer — the ability to translate a delivery intent into a sequence of API calls, browser actions, or structured human handoffs, and then actually run them.

This document maps what's possible today, what's already been built, what's missing, and exactly what to build next.

---

## What HubSpot's API can actually do (the foundation)

This is important because it defines what's automatable vs. what needs a human.

### Can be done 100% via API (no browser needed)

| HubSpot Object | Operations |
|---|---|
| Contact/Company/Deal properties | Create, update, delete, reorder, add options |
| Property groups | Create, list, assign |
| Pipelines + stages | Create, update, reorder, set probabilities |
| CRM Lists (active + static) | Create, add/remove members |
| Workflows | Create, update, delete, clone — via v4 Automation API (beta, now in public beta Jan 2025) |
| Workflow actions | Set property, send email, create task, webhook, delay, branch, enrol in sequence |
| Custom objects | Define new object types + properties |
| Association labels | Define custom relationship types |
| Forms | Create, update |
| Email templates | Create, update |
| CRM records | Full CRUD on contacts, companies, deals, tickets |
| Owners | List, search |

### Needs browser session (CSRF API — already built)

| Task | Why |
|---|---|
| Dashboards + reports | No public OAuth API — internal v1 API with CSRF token ✅ already built |
| Custom behavioral events | UI-only setup |
| Sandbox provisioning | UI action |

### Needs Cowork (desktop agent)

| Task | Why |
|---|---|
| Visual drag-and-drop workflows (complex branching) | v4 API supports structure but complex multi-branch is easier in UI |
| Page builder / website edits | No API |
| Importing contacts from CSV | File upload via UI |
| Connecting integrations (app marketplace) | Auth flows require clicks |

### Cannot be automated (human only)

| Task | Why |
|---|---|
| SSO / SAML setup | Security — must be done by portal admin |
| Billing changes | Account-level actions |
| Data migration sign-off | Client approval required |

---

## The real architecture gap — four missing layers

### Layer 1: HubSpot Write Client (missing, critical)

We have a `BrowserSessionExecutor` for dashboards and a HubSpot MCP for reads. What's missing is a **full programmatic HubSpot write client** using private app tokens that covers:

- Properties (any object type)
- Pipelines + stages
- Workflows (v4 Automation API)
- Lists
- Forms
- Email templates
- CRM records

This is the engine that makes agents actually do HubSpot work. Without it, every job either hits a dead end or falls through to Cowork.

**Package to create:** `packages/hubspot-client/` with a `HubSpotWriteClient` class. Private app token per portal (stored in `PortalSession`).

### Layer 2: Task Decomposer (missing, critical)

Right now a job has a `moduleKey` (`portal_audit`, `property_apply`, `dashboard_build`). That's fine for predefined jobs. But the real unlock is natural language → job queue:

> "Set up lead source tracking for epiuse — they need primary_lead_source property, a dashboard showing leads by source, and a workflow that sets lifecycle stage to MQL when lead score hits 50"

That's three jobs. The decomposer breaks it down:
1. `property_apply` — ensure `primary_lead_source` exists with correct options
2. `dashboard_build` — create leads-by-source dashboard (already built)
3. `workflow_build` — create lifecycle MQL workflow via v4 API

Each job is queued with its own context and executed in the right order.

**Component to build:** `packages/task-decomposer/` — AI agent that takes a natural language request + project context and outputs an ordered array of `ExecutionJob` specs.

### Layer 3: Project Memory (missing, high value)

Every time an agent runs a job, it learns something about the portal. Right now that learning disappears. What we need:

- **Portal snapshot** (already partially there — contacts count, deals count, properties count)
- **Build log** — "on 15 March we created `primary_lead_source` with 13 options"
- **Current state** — what workflows exist, what properties exist, what dashboards exist
- **Agent decisions** — why the agent chose to do X instead of Y

This makes the system genuinely useful over time. The second time you run a job for epiuse, the system already knows what's there.

**Schema additions:** `PortalMemory` model (projectId, portalId, buildLog Json[], portalSnapshot Json, lastRefreshed DateTime)

### Layer 4: Proactive Intelligence (future, phase 3)

The platform monitors project state and triggers actions automatically:

- Blueprint approved + no delivery tasks → suggest creating delivery task list
- Client hasn't been updated in 7 days → draft a progress email
- Portal snapshot stale > 24hrs → refresh it in the background
- Quick win marked open for > 14 days → flag as overdue

This is a scheduled worker that runs every hour and posts suggestions to the project Inbox.

---

## The five agents to build

These are the concrete agents that deliver work. Ordered by impact and buildability.

### Agent 1: Portal Audit Agent
*Already scaffolded — needs completion*

**What it does:** Connects to a client's HubSpot portal and returns a structured health report covering:
- Properties: missing, duplicated, or poorly configured
- Pipelines: missing stages, no close reason property, deal stage probability not set
- Workflows: inactive workflows, workflows without error notifications
- Dashboards: whether key reporting dashboards exist
- Contacts: % with missing lead source, % with missing lifecycle stage, duplicate contacts
- Quick wins: top 10 fixes ordered by impact

**Execution path:** MCP reads → structured analysis → Claude → structured report → saved to project
**HubSpot API used:** GET properties, GET pipelines, GET workflows (list), GET dashboards (browser session), search CRM objects
**Status:** Partially exists. Processor stub in `processors/portalAudit.ts`. Needs the analysis logic + structured output format.

---

### Agent 2: Property Builder Agent
*New — high impact, fully API-executable*

**What it does:** Takes a list of properties to create/update and executes them:
- Checks if property already exists (existence-check-before-create pattern ✅ already proven)
- Creates missing properties with correct type, field type, options, group
- Updates properties that have wrong options or are in the wrong group
- Produces a diff report: created X, updated Y, skipped Z (already existed correctly)

**Execution path:** Pure API — no browser needed
**HubSpot API used:** `GET /crm/v3/properties/{objectType}/{name}`, `POST /crm/v3/properties/{objectType}`, `PATCH /crm/v3/properties/{objectType}/{name}`
**Input:** Array of property specs (name, type, fieldType, label, options, groupName, objectType)
**Status:** Processor stub exists. Needs the `HubSpotWriteClient` and full execution logic.

**Templates to build:**
- Lead source property set (primary_lead_source + last_lead_source + lead_source_detail)
- Lifecycle tracking set (lifecycle_stage_date properties — when did they become MQL, SQL, etc.)
- Deal tracking set (close_reason, deal_source, competitor)
- Muloo standard audit set (last_key_action, last_client_communication_date)

---

### Agent 3: Workflow Builder Agent
*New — this is the one Jarrud specifically mentioned (HubResolution equivalent)*

**What it does:** Takes a workflow description in natural language and creates a working HubSpot workflow via the v4 Automation API.

**Example inputs:**
- "Create a contact workflow that sets lifecycle stage to MQL when lead score is ≥ 50"
- "Create a deal workflow that notifies the owner via task when a deal moves to Contract Sent stage"
- "Create a contact workflow that sends an internal notification when a contact hasn't been contacted in 30 days"

**How it works:**
1. Claude receives the description + portal context (what properties exist, what pipelines exist)
2. Claude generates a workflow JSON spec in HubSpot's v4 Automation API format
3. Agent validates the spec (checks property names exist, etc.)
4. Submits to `POST /automation/v4/flows`
5. Returns workflow ID + link

**HubSpot API used:** `POST /automation/v4/flows`, `GET /automation/v4/flows` (for validation)
**Complexity:** Medium-high. v4 API is in public beta. Action schema is well-documented.
**Status:** Not started.

**Workflow action types supported by v4 API:**
- `SET_CONTACT_PROPERTY` / `SET_COMPANY_PROPERTY` / `SET_DEAL_PROPERTY`
- `CREATE_TASK`
- `SEND_EMAIL` (internal notification)
- `DELAY` (by time period or until condition)
- `BRANCH` (if/else based on property value)
- `WEBHOOK`
- `ENROLL_IN_SEQUENCE`
- `ADD_TO_LIST` / `REMOVE_FROM_LIST`

---

### Agent 4: Discovery Research Agent
*Partially exists (Sprint 03 spec) — refine the scope*

**What it does:** Given a project context (client type, hubs in scope, goals), generates structured discovery questions, organises them into sessions, and populates the project's discovery section.

**Extended capability:** Post-discovery, takes all answered questions and generates:
- A written discovery summary for the blueprint
- A gap analysis (what they said they need vs. what their portal has)
- A prioritised quick wins list
- A scope recommendation

**Execution path:** Perplexity research (if relevant) → Claude → structured output → saved to project
**Status:** Sprint 03 specced. Needs refining to include post-discovery synthesis.

---

### Agent 5: Comms Agent
*New — proactive, phase 2*

**What it does:**
- Detects when a client update is overdue (last email > 7 days + project active)
- Drafts a personalised status update based on: what was completed this week, what's coming next, any blockers
- Posts to project Inbox as a draft for Jarrud to review + send
- Can also be triggered manually: "draft a weekly update for epiuse"

**Execution path:** Project state read → Claude → draft email → Inbox notification
**Data sources:** completed tasks, execution job logs, blueprint status, quick wins resolved
**Status:** Email composer exists (Sprint 06). Comms Agent is the proactive layer on top.

---

## What to build next — phased plan

### Phase 1 — Make the existing agents work (now, 2 weeks)

The BullMQ worker runs. The processors are mostly stubs. The single biggest impact action is completing them.

1. **Complete `HubSpotWriteClient`** — private app token auth, properties CRUD, pipelines CRUD
   - File: `packages/hubspot-client/src/HubSpotWriteClient.ts`
   - These are standard OAuth API calls — no browser session needed

2. **Complete Portal Audit Agent** (`processors/portalAudit.ts`)
   - Read properties, pipelines, workflows via MCP + write client
   - Run structured analysis via Claude
   - Save to project as `auditReport`

3. **Complete Property Builder Agent** (`processors/propertyApply.ts`)
   - Use write client to create/update properties
   - Implement existence-check pattern (already proven in Portal Ops)
   - Output a diff log

4. **Complete Dashboard Build Agent** (`processors/dashboardBuild.ts`)
   - Use BrowserSessionExecutor (already built in Sprint 00/02)
   - Map template key → report JSON → create reports → create dashboard

### Phase 2 — Task Decomposer + Workflow Builder (4 weeks out)

5. **Task Decomposer** — natural language → array of ExecutionJob specs
   - New endpoint: `POST /api/jobs/decompose` — takes `{ request: string, projectId: string }`
   - Returns: `{ jobs: ExecutionJobSpec[], explanation: string }`
   - Jarrud reviews + approves before jobs are queued (or auto-queues if confidence is high)

6. **Workflow Builder Agent** — creates HubSpot workflows via v4 API
   - New processor: `processors/workflowBuild.ts`
   - Needs: HubSpot private app with `automation` scope
   - Input: `{ description: string, portalId: string }`
   - Process: Claude generates v4 API JSON → validate → submit → return workflow URL

7. **AdHoc Job creation from chat** — type a request in the command centre and it queues the right jobs
   - New UI: "What do you want to do?" input in Command Centre
   - Calls `/api/jobs/decompose`, shows proposed jobs, one-click queue

### Phase 3 — Memory + Proactive Intelligence (6-8 weeks out)

8. **Project Memory / Portal State cache**
   - `PortalMemory` table — persists portal snapshots and build logs
   - Agents read memory before running (avoid re-creating things)
   - Background refresh job runs every 24hrs

9. **Suggestion Engine**
   - Scheduled worker (every hour) checks project conditions
   - Posts suggestions as items in project Inbox
   - Examples: "blueprint approved but no delivery tasks created", "epiuse portal snapshot is 3 days old"

10. **Proactive Comms Agent**
    - Detects update-overdue conditions
    - Drafts and queues client update emails
    - Jarrud approves from Inbox before send

---

## What tools/frameworks to adopt

### Keep and extend (already in the stack)

| Tool | Role |
|---|---|
| BullMQ | Job queue — good choice, keep it |
| HubSpot MCP | Read-only portal queries — good for reads |
| Browser Session API (CSRF) | Dashboards + reports — already built |
| Claude (via Anthropic API) | Agent reasoning, content generation |
| Cowork (desktop agent) | Fallback for things the API can't do |

### Add to the stack

| Tool | Role | Why |
|---|---|---|
| HubSpot v4 Automation API | Workflow creation | The key unlock — build workflows programmatically |
| HubSpot Private App token | Write operations | Better than CSRF for non-dashboard writes — stable OAuth token |
| n8n (optional, self-hosted) | Complex orchestration chains | If multi-step agent chains get complex, n8n nodes are a clean alternative to custom BullMQ processors |
| Perplexity API | Research agent | Already in Sprint 03 spec |
| Resend or SendGrid | Outbound email | If Comms Agent needs to actually send (not just draft) |

### HubSpot Breeze — worth understanding, not building for

Breeze is HubSpot's own AI layer. The relevant bit for us is the **Agent Tools beta** (2025.2 developer platform) — you can build custom workflow actions and mark them as available to Breeze agents. This means a Muloo-built workflow action (e.g. "run portal audit") could be invokable from inside HubSpot by Breeze.

That's an interesting future integration — Breeze asks a HubSpot user "do you want to run a Muloo portal audit?" and our API handles it. Not a priority now, but worth knowing the door is open.

---

## What to tell Hawk to build next (Sprint 08)

The Sprint 07 UX redesign should land first. Once that's in, the next dev sprint is:

**Sprint 08 — HubSpot Write Client + Agent Completions**

```
1. Create packages/hubspot-client/ with HubSpotWriteClient
   - Constructor: takes { portalId, privateAppToken }
   - Methods:
     - createProperty(objectType, spec) → PropertyResult
     - updateProperty(objectType, name, patch) → PropertyResult
     - getProperty(objectType, name) → PropertyResult | null
     - createPipeline(objectType, spec) → PipelineResult
     - updatePipelineStage(pipelineId, stageId, patch) → StageResult
     - createList(spec) → ListResult
     - createWorkflow(spec) → WorkflowResult  [v4 API]
     - getWorkflows() → WorkflowResult[]

2. Complete processors/portalAudit.ts
   - Use HubSpotWriteClient to fetch properties, pipelines
   - Use MCP to fetch contacts/deals snapshot
   - Run Claude analysis against Muloo's audit rubric
   - Save structured report to project.auditReport (new Json field)

3. Complete processors/propertyApply.ts
   - Accept array of PropertySpec in job data
   - For each: check existence → create or skip → log outcome
   - Return diff: { created[], skipped[], failed[] }

4. Add POST /api/projects/:id/audit to apps/api/src/app.ts
   - Queues a portal_audit job for the project's connected portal
   - Returns job ID

5. Add private app token storage
   - Add privateAppToken String? to PortalSession in Prisma schema
   - Add PATCH /api/portal-sessions/:portalId to update the token
   - Show token input field in Portal tab of project page
```

---

## Summary: the single most important shift

The platform currently asks: "What happened with this project?"

The platform needs to ask: "What should happen next — and can I do it?"

That shift requires three things working together:
1. **A write client** that can execute HubSpot config work (the engine)
2. **A task decomposer** that can turn intent into jobs (the router)
3. **Project memory** that persists what's been built (the brain)

Everything else — workflow builder, comms agent, proactive suggestions — sits on top of those three foundations.

---

*Last updated: 26 Mar 2026*
