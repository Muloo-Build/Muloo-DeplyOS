# Sprint: Portal Ops — Tiered HubSpot Execution Layer + Marketing Dashboard Agent

**Status:** Ready for implementation
**Priority:** P0 — core platform capability
**Estimated effort:** 3–5 days
**Assigned to:** Codex
**Authored by:** Jarrud (Muloo), Claude (Deploy OS session, 26 Mar 2026)

---

## Context & Why This Exists

This sprint was born from a live client delivery session. epiuse.co.uk needed a marketing dashboard built in HubSpot — today. The Portal Ops tool correctly identified the required properties and steps, but returned a `manual_plan` because the HubSpot MCP doesn't expose property creation or dashboard/report APIs.

During that session, Claude discovered that:

1. The HubSpot internal v1 API is accessible from an authenticated browser session using the `hubspotapi-csrf` cookie as a request header — no OAuth token required
2. Both `primary_lead_source` and `last_key_action` custom properties already existed in the portal but the MCP semantic search returned false negatives
3. HubSpot dashboard/report creation requires complex JSON payloads but follows a predictable schema that can be templatised

**The platform gap:** The `executionType` field already has `api | cowork | manual` values in the schema, but the execution pipeline doesn't implement the full tier cascade. When the MCP fails, it falls straight to `manual`. This sprint closes that gap.

**The bigger picture:** This is the foundational capability for the partner platform — where HubSpot partners execute marketing work for clients at scale, and clients pay for access. Every automation we wire now is a billable execution in that future product.

---

## Goals

1. Implement a **Tier 2 browser session execution layer** that fires HubSpot internal API calls when the MCP can't act
2. Add an **existence-check-before-create** pattern to all property operations to eliminate false negatives and duplication
3. Build a **marketing report template system** with pre-defined JSON payloads for standard marketing dashboard charts
4. Create a **Marketing Dashboard Agent** that can assemble a full marketing dashboard for any connected portal using templates
5. Wire the **Cowork fallback (Tier 3)** so that when both API tiers fail, the system tags a Cowork computer-use step with exact instructions rather than returning a manual plan

---

## Out of Scope (This Sprint)

- Partner platform UI (future sprint)
- Workflow creation/mutation (complex, separate sprint)
- Multi-portal batch execution
- Full dashboard cloning between portals
- Attribution reporting (enterprise-tier, needs separate qualification)

---

## Architecture: The 4-Tier Execution Model

```
Tier 1 — HubSpot MCP
  ↓ (if capability = unsupported or mcp_error)
Tier 2 — Browser Session Internal API
  (hubspotapi-csrf cookie + X-HubSpot-CSRF-hubspotapi header)
  ↓ (if no active browser session or API returns error)
Tier 3 — Cowork Computer Use
  (Chrome MCP DOM automation against app-eu1.hubspot.com)
  ↓ (if action is genuinely irreversible or complex)
Tier 4 — Human Handover
  (precise step-by-step with URLs, field names, exact values)
```

Each tier must **log its attempt and outcome** to `ExecutionJob` with `executionMethod` set to the tier used.

---

## Part 1: Existence-Check-Before-Create Pattern

### Problem
The current `propertiesModule.ts` attempts to create properties without first checking if they exist. The HubSpot MCP semantic search returns false negatives for custom properties (e.g. `primary_lead_source` in `custom_properties_-_muloo` group was not found by keyword search but existed).

### Solution
Add a `checkPropertyExists()` function that calls the HubSpot API directly by exact name before any create operation.

### Files to modify
- `packages/hubspot-client/src/hubspotClient.ts`
- `packages/executor/src/propertiesModule.ts`

### Implementation

**In `hubspotClient.ts` — add:**

```typescript
/**
 * Check if a specific property exists by exact internal name.
 * Uses GET /crm/v3/properties/{objectType}/{propertyName}
 * Returns the property definition if found, null if not found (404).
 */
async getPropertyByName(
  objectType: 'contacts' | 'companies' | 'deals' | 'tickets',
  propertyName: string
): Promise<HubSpotProperty | null> {
  try {
    const response = await this.client.crm.properties.coreApi.getByName(
      objectType,
      propertyName
    );
    return response;
  } catch (err: any) {
    if (err?.code === 404 || err?.response?.status === 404) {
      return null;
    }
    throw err;
  }
}
```

**In `propertiesModule.ts` — wrap every create with an existence check:**

```typescript
async function ensurePropertyExists(
  client: HubSpotClient,
  objectType: 'contacts' | 'companies' | 'deals' | 'tickets',
  propertyDef: PropertyDefinition
): Promise<{ action: 'created' | 'already_exists' | 'updated'; property: HubSpotProperty }> {
  const existing = await client.getPropertyByName(objectType, propertyDef.name);

  if (existing) {
    return { action: 'already_exists', property: existing };
  }

  const created = await client.createProperty(objectType, propertyDef);
  return { action: 'created', property: created };
}
```

All `ExecutionJob` logs must record `action: 'created' | 'already_exists'` to make audits meaningful.

---

## Part 2: Tier 2 — Browser Session Execution Layer

### How It Works
When the Deploy OS server is executing a HubSpot operation that the MCP can't support (e.g. property creation via a non-MCP path), it can delegate to a browser session execution call. The user's active HubSpot session provides auth via the `hubspotapi-csrf` cookie.

The key discovery from this session: HubSpot's internal v1 API accepts requests authenticated with:
- Session cookies (automatically sent by the browser)
- `X-HubSpot-CSRF-hubspotapi` header set to the value of the `hubspotapi-csrf` cookie

This means a JavaScript `fetch()` call from within an authenticated HubSpot page context can call the full internal API with no OAuth token.

### New Package: `packages/browser-session-executor/`

Create a new package with the following structure:

```
packages/browser-session-executor/
├── src/
│   ├── index.ts                    # Package exports
│   ├── BrowserSessionExecutor.ts  # Core executor class
│   ├── hubspotInternalApi.ts      # HubSpot internal API methods
│   ├── csrfExtractor.ts           # CSRF token extraction from browser
│   └── types.ts                   # Types & interfaces
├── package.json
└── tsconfig.json
```

### `BrowserSessionExecutor.ts`

```typescript
export interface BrowserSessionConfig {
  portalId: string;
  csrfToken: string;     // Value of hubspotapi-csrf cookie
  baseUrl: string;       // e.g. https://app-eu1.hubspot.com
}

export interface ExecutionResult {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  tier: 'browser_session';
}

export class BrowserSessionExecutor {
  constructor(private config: BrowserSessionConfig) {}

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'X-HubSpot-CSRF-hubspotapi': this.config.csrfToken,
    };
  }

  async createContactProperty(propertyDef: PropertyDefinition): Promise<ExecutionResult>
  async getContactProperty(name: string): Promise<ExecutionResult>
  async createReport(reportDef: ReportDefinition): Promise<ExecutionResult>
  async createDashboard(dashboardDef: DashboardDefinition): Promise<ExecutionResult>
  async addReportToDashboard(dashboardId: string, reportId: string): Promise<ExecutionResult>
}
```

### Internal API Endpoints to Support

| Operation | Method | Endpoint |
|---|---|---|
| Get property | GET | `/api/properties/v1/{objectType}/properties/named/{name}?portalId={id}` |
| Create property | POST | `/api/properties/v1/{objectType}/properties?portalId={id}` |
| Create report | POST | `/api/reports/v2/reports?portalId={id}` |
| Create dashboard | POST | `/api/reports/v2/dashboards?portalId={id}` |
| Add report to dashboard | PUT | `/api/reports/v2/dashboards/{dashboardId}?portalId={id}` |
| List dashboards | GET | `/api/reports/v2/dashboards?portalId={id}` |

### CSRF Token Flow

The CSRF token needs to reach the `BrowserSessionExecutor`. There are two scenarios:

**Scenario A — Cowork-triggered execution:**
Claude (in Cowork) extracts the token from the browser and passes it to the API as part of the execution payload. The API then instantiates `BrowserSessionExecutor` with it.

**Scenario B — User-initiated from Deploy OS frontend:**
The web app has a "Connect browser session" button that triggers a Chrome extension message to extract the cookie and send it back to the Deploy OS session. Store it in `PortalSession` (new model, see below).

**For this sprint, implement Scenario A only.** Scenario B is a separate sprint.

### New Prisma Model: `PortalSession`

```prisma
model PortalSession {
  id          String   @id @default(cuid())
  portalId    String
  csrfToken   String
  baseUrl     String   // app-eu1 vs app vs app-na1 etc.
  capturedAt  DateTime @default(now())
  expiresAt   DateTime?
  capturedBy  String   // user email
  valid       Boolean  @default(true)

  @@index([portalId, valid])
}
```

### API Endpoint: `POST /portal-session`

Add to `apps/api/src/app.ts`:

```typescript
// Receive a browser session token from Cowork or frontend
app.post('/portal-session', async (c) => {
  const { portalId, csrfToken, baseUrl, capturedBy } = await c.req.json();

  // Validate token by making a test API call
  const executor = new BrowserSessionExecutor({ portalId, csrfToken, baseUrl });
  const testResult = await executor.validateSession();

  if (!testResult.success) {
    return c.json({ error: 'Invalid or expired session token' }, 401);
  }

  const session = await prisma.portalSession.create({
    data: { portalId, csrfToken, baseUrl, capturedBy, valid: true }
  });

  return c.json({ sessionId: session.id, valid: true });
});
```

---

## Part 3: Marketing Report Template System

### Problem
HubSpot dashboard/report JSON payloads are complex (data sources, dimensions, measures, filters, chart configs). We need pre-defined templates that the agent can instantiate against any portal.

### New Package: `packages/report-templates/`

```
packages/report-templates/
├── src/
│   ├── index.ts
│   ├── templates/
│   │   ├── marketing/
│   │   │   ├── contactsBySource.ts
│   │   │   ├── mqlTrend.ts
│   │   │   ├── mqlBySource.ts
│   │   │   ├── lifecycleStageBreakdown.ts
│   │   │   ├── leadToMqlConversion.ts
│   │   │   ├── closedWonByMonth.ts
│   │   │   ├── pipelineByStage.ts
│   │   │   ├── revenueBySource.ts
│   │   │   ├── lastKeyActionDistribution.ts
│   │   │   └── dataQualityMissingSource.ts
│   │   └── index.ts
│   ├── TemplateEngine.ts           # Instantiates templates for a specific portal
│   └── types.ts
```

### Template Interface

```typescript
export interface ReportTemplate {
  id: string;                        // e.g. 'contacts_by_source'
  name: string;                      // e.g. 'Contacts by Primary Lead Source'
  section: DashboardSection;         // volume | conversion | source | revenue | hygiene
  chartType: 'BAR' | 'DONUT' | 'LINE' | 'NUMERIC' | 'TABLE';
  requiredProperties: string[];      // property names that must exist
  description: string;
  build(config: TemplateConfig): ReportDefinition;
}

export interface TemplateConfig {
  portalId: string;
  primaryLeadSourceProperty?: string;    // defaults to 'primary_lead_source'
  lastKeyActionProperty?: string;        // defaults to 'last_key_action'
  dateRange?: { start: string; end: string };
}

export interface ReportDefinition {
  name: string;
  description: string;
  reportType: string;
  filters: ReportFilter[];
  dimensions: ReportDimension[];
  metrics: ReportMetric[];
  visualizationType: string;
  dateRange: object;
}
```

### Template: `contactsBySource.ts` (example implementation)

```typescript
import { ReportTemplate, TemplateConfig, ReportDefinition } from '../types';

export const contactsBySource: ReportTemplate = {
  id: 'contacts_by_source',
  name: 'Contacts by Primary Lead Source',
  section: 'source',
  chartType: 'BAR',
  requiredProperties: ['primary_lead_source'],
  description: 'Bar chart showing total contacts grouped by their primary lead source value',

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Contacts by Primary Lead Source',
      description: 'Volume breakdown by source of origin',
      reportType: 'CONTACTS',
      filters: [],
      dimensions: [
        {
          property: config.primaryLeadSourceProperty ?? 'primary_lead_source',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'BAR',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 365
      }
    };
  }
};
```

### Required Templates (implement all 10)

| Template ID | Section | Chart Type | Key Property |
|---|---|---|---|
| `contacts_by_source` | Source | BAR | `primary_lead_source` |
| `contacts_created_by_month` | Volume | BAR | `createdate` |
| `mql_by_month` | Volume | LINE | `hs_v2_date_entered_marketingqualifiedlead` |
| `mql_by_source` | Source | BAR | `primary_lead_source` |
| `lifecycle_stage_breakdown` | Conversion | DONUT | `lifecyclestage` |
| `lead_to_mql_conversion` | Conversion | NUMERIC | `hs_v2_date_entered_lead` + MQL date |
| `closed_won_by_month` | Revenue | BAR | `closedate` (deals) |
| `pipeline_by_stage` | Revenue | BAR | `dealstage` |
| `last_key_action_distribution` | Conversion | DONUT | `last_key_action` |
| `missing_source_contacts` | Hygiene | NUMERIC | `primary_lead_source` (null check) |

---

## Part 4: Marketing Dashboard Agent

### Agent Definition

Add to the `AgentDefinition` table (or equivalent agent registry):

```typescript
{
  slug: 'marketing-dashboard-builder',
  name: 'Marketing Dashboard Builder',
  purpose: 'Assembles a complete marketing performance dashboard in HubSpot using existing portal properties and pre-built report templates. Checks for existing properties, validates data availability, creates reports, and assembles the dashboard.',
  serviceFamily: 'hubspot_architecture',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  triggerType: 'manual',
  approvalMode: 'require_approval',
  allowedActions: [
    'read_portal_properties',
    'check_property_exists',
    'create_report',
    'create_dashboard',
    'add_report_to_dashboard',
    'write_execution_job_log'
  ]
}
```

### Agent Location

`packages/executor/src/agents/marketingDashboardAgent.ts`

### Agent Flow

```
1. RECEIVE prompt + portalId + sessionId (optional)

2. AUDIT PHASE
   ├── For each required property in all templates:
   │   └── Call getPropertyByName() — log exists/missing
   └── Identify which templates are fully buildable vs blocked

3. PLAN PHASE
   ├── Group buildable templates by dashboard section
   ├── Determine execution tier:
   │   ├── Tier 1: If HubSpot MCP supports the operation
   │   ├── Tier 2: If PortalSession exists for this portalId
   │   └── Tier 4: No session available — return manual plan
   └── Log plan to ExecutionJob with status 'planned'

4. EXECUTE PHASE (per template, in order)
   ├── For each template:
   │   ├── build(config) → ReportDefinition
   │   ├── createReport(reportDef) via appropriate tier
   │   ├── Log report ID + outcome to ExecutionJob
   │   └── On error: log + continue (don't abort full run)
   └── createDashboard({ name: 'Marketing Dashboard', sections: [...] })

5. ASSEMBLE PHASE
   ├── addReportToDashboard() for each created report
   ├── Order reports by section and displayOrder
   └── Log final dashboard URL to ExecutionJob

6. HANDOVER PHASE
   ├── Return dashboard URL if fully built
   ├── Return partial dashboard URL + list of manual steps if partially built
   └── Return full manual plan if no execution tier was available
```

### Agent Input Schema

```typescript
interface MarketingDashboardInput {
  portalId: string;
  dashboardName?: string;              // default: 'Marketing Dashboard'
  sessionId?: string;                  // PortalSession ID for Tier 2
  primaryLeadSourceProperty?: string;  // override if named differently
  lastKeyActionProperty?: string;      // override if named differently
  sectionsToInclude?: DashboardSection[]; // default: all 5 sections
  dryRun?: boolean;                    // plan only, no writes
}
```

### Agent Output Schema

```typescript
interface MarketingDashboardOutput {
  status: 'complete' | 'partial' | 'plan_only' | 'error';
  dashboardUrl?: string;
  dashboardId?: string;
  reportsCreated: Array<{
    templateId: string;
    reportId: string;
    name: string;
    section: string;
    executionTier: 1 | 2 | 3 | 4;
    status: 'created' | 'skipped' | 'failed';
  }>;
  manualSteps?: ManualStep[];     // if any reports couldn't be automated
  executionJobId: string;
  summary: string;
}
```

---

## Part 5: Cowork Tier 3 Fallback

### When Tier 3 Triggers
- No `PortalSession` available (no browser session token)
- Browser session API returns auth error or unexpected 5xx
- Operation is a report/dashboard type (complex UI-dependent)

### What Tier 3 Produces

Instead of returning a generic manual plan, the system produces a **Cowork execution instruction** — a structured payload that Cowork (Claude in the desktop app) can pick up and execute via Chrome MCP.

### New Type: `CoworkInstruction`

```typescript
interface CoworkInstruction {
  id: string;
  taskType: 'hubspot_property_create' | 'hubspot_report_create' | 'hubspot_dashboard_create';
  portalId: string;
  targetUrl: string;        // exact HubSpot URL to navigate to
  steps: CoworkStep[];
  expectedOutcome: string;
  fallbackToManual: ManualStep[];
}

interface CoworkStep {
  order: number;
  action: 'navigate' | 'click' | 'fill_field' | 'select_option' | 'verify';
  target: string;           // CSS selector, text, or description
  value?: string;           // for fill_field and select_option
  description: string;      // human-readable
}
```

### Example: Property Create Cowork Instruction

```typescript
{
  taskType: 'hubspot_property_create',
  portalId: '146339210',
  targetUrl: 'https://app-eu1.hubspot.com/property-settings/146339210/properties?type=0-1&action=create',
  steps: [
    { order: 1, action: 'navigate', target: 'url', description: 'Navigate to contact property creation page' },
    { order: 2, action: 'fill_field', target: 'Property label', value: 'Primary Lead Source', description: 'Enter property label' },
    { order: 3, action: 'select_option', target: 'Field type', value: 'Dropdown select', description: 'Set field type to dropdown' },
    { order: 4, action: 'fill_field', target: 'Group', value: 'Contact information', description: 'Assign to contact information group' },
    { order: 5, action: 'click', target: 'Create property', description: 'Submit property creation' },
    { order: 6, action: 'verify', target: 'Property created', description: 'Confirm success toast appears' }
  ]
}
```

### API Endpoint: `GET /execution-jobs/:id/cowork-instruction`

Returns the `CoworkInstruction` for a given job when the job's execution tier is `cowork`. Cowork polls this endpoint and picks up pending instructions.

---

## Part 6: Portal Ops Prompt → Execution Pipeline

### Updated Portal Ops Flow

The Portal Ops tool currently returns a `manual_plan` for dashboard/reporting requests. This sprint updates the flow to:

```
1. Receive natural language request
2. Classify capability (existing logic)
3. If capability = 'dashboards_and_reporting':
   ├── Invoke Marketing Dashboard Agent
   ├── Agent runs audit phase
   ├── Agent determines available execution tier
   └── Returns: execution plan OR direct result
4. If execution tier available → execute
5. If not → return CoworkInstruction (not generic manual plan)
```

### Files to Modify

- `apps/api/src/app.ts` — add new endpoints, update Portal Ops route handler
- `packages/executor/src/agents/portalAuditAgent.ts` — add dashboard agent delegation
- `apps/web/app/projects/portal-ops/page.tsx` — surface Cowork instructions and execution tier in UI

---

## Execution Readiness Ladder Update

Update `executionReadiness` to include the tier:

```typescript
type ExecutionReadiness =
  | 'not_ready'
  | 'assisted'                    // human-assisted manual
  | 'cowork_required'             // Tier 3 — Cowork can execute
  | 'browser_session_required'    // Tier 2 — needs active session
  | 'ready_with_review'           // Tier 1 — MCP, needs human review
  | 'ready';                      // Tier 1 — fully automated
```

---

## Database Migrations Required

```prisma
// New model
model PortalSession {
  id         String   @id @default(cuid())
  portalId   String
  csrfToken  String
  baseUrl    String
  capturedAt DateTime @default(now())
  expiresAt  DateTime?
  capturedBy String
  valid      Boolean  @default(true)

  @@index([portalId, valid])
}

// Update ExecutionJob
model ExecutionJob {
  // ... existing fields ...
  executionTier    Int?    // 1 | 2 | 3 | 4
  coworkInstruction Json?  // CoworkInstruction payload if tier = 3
}

// Update Task
model Task {
  // ... existing fields ...
  executionReadiness String @default("not_ready")
  // executionReadiness now includes: cowork_required | browser_session_required
}
```

---

## New API Endpoints Summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/portal-session` | Register a browser session token |
| GET | `/portal-session/:portalId/valid` | Check if a valid session exists |
| POST | `/agents/marketing-dashboard` | Trigger dashboard build for a portal |
| GET | `/execution-jobs/:id/cowork-instruction` | Get Cowork instruction for a job |
| GET | `/report-templates` | List all available report templates |
| GET | `/report-templates/:id` | Get a specific template definition |

---

## Skills Required (Deploy OS Skill Registry)

These skills should be registered in the Deploy OS skill system so agents can reference them by name:

### `hubspot.browser-session.extract-csrf`
**Purpose:** Extract the `hubspotapi-csrf` cookie value from an active HubSpot browser tab
**Inputs:** `portalId`
**Outputs:** `{ csrfToken, baseUrl, capturedAt }`
**Execution:** Cowork (Chrome MCP) — JavaScript `document.cookie` extraction
**Used by:** Marketing Dashboard Agent (Tier 2 setup)

### `hubspot.properties.ensure-exists`
**Purpose:** Check if a property exists; create it if not; never duplicate
**Inputs:** `objectType, propertyName, propertyDefinition`
**Outputs:** `{ action: 'created' | 'already_exists', property }`
**Execution:** Tier 1 (HubSpot MCP) → Tier 2 (Browser Session API)
**Used by:** Marketing Dashboard Agent, Portal Audit Agent

### `hubspot.reports.create-from-template`
**Purpose:** Build a report payload from a template ID and create it in HubSpot
**Inputs:** `templateId, portalId, config`
**Outputs:** `{ reportId, reportUrl, status }`
**Execution:** Tier 2 (Browser Session API)
**Used by:** Marketing Dashboard Agent

### `hubspot.dashboard.assemble`
**Purpose:** Create a named dashboard and add a set of report IDs to it
**Inputs:** `dashboardName, reportIds, portalId`
**Outputs:** `{ dashboardId, dashboardUrl, status }`
**Execution:** Tier 2 (Browser Session API)
**Used by:** Marketing Dashboard Agent

### `hubspot.portal.audit-properties`
**Purpose:** Audit a full list of required properties against a portal, using direct GET by name rather than semantic search
**Inputs:** `portalId, requiredProperties[]`
**Outputs:** `{ exists: PropertyMap, missing: string[], mismatched: PropertyMap }`
**Execution:** Tier 1 (HubSpot MCP) + direct GET fallback
**Used by:** Marketing Dashboard Agent, Portal Audit Agent

---

## Agents Required

### Existing: `portalAuditAgent` (update)
- Add delegation to `marketingDashboardAgent` when capability = `dashboards_and_reporting`
- Add property existence check before any property-related execution step
- Replace `manual_plan` returns with `CoworkInstruction` where applicable

### New: `marketingDashboardAgent`
- Full spec in Part 4 above
- File: `packages/executor/src/agents/marketingDashboardAgent.ts`
- Orchestrates: audit → plan → execute → assemble → handover

---

## Testing

### Unit Tests

- `packages/browser-session-executor/src/__tests__/BrowserSessionExecutor.test.ts`
  - Mock CSRF token extraction
  - Mock internal API responses
  - Test property create, report create, dashboard create
  - Test failure handling and tier fallback

- `packages/report-templates/src/__tests__/TemplateEngine.test.ts`
  - Test each template builds valid JSON
  - Test requiredProperties validation
  - Test config overrides

- `packages/executor/src/__tests__/marketingDashboardAgent.test.ts`
  - Test full agent flow with mocked HubSpot client
  - Test dry-run mode
  - Test partial execution (some templates fail, dashboard still creates)
  - Test CoworkInstruction generation when no session available

### Integration Tests (smoke)

Add to `tests/`:
- `portal-session-registration.test.ts` — register session, validate, expire
- `marketing-dashboard-dry-run.test.ts` — run agent in dry-run mode against epiuse portal

---

## Partner Platform Vision (Architectural Note for Codex)

This sprint builds the **execution engine** that the future partner platform sits on top of. Keep this in mind when making architectural decisions:

**Partner Platform Model:**
- Partners connect their clients' HubSpot portals to Deploy OS
- Partners select marketing work packages (e.g. "Marketing Dashboard Setup")
- Deploy OS executes the work automatically via the tiered execution model
- Clients get a delivery board showing progress and outputs
- Partners charge clients for access to automated delivery

**Implications for this sprint:**
- Every operation must be **portal-scoped** — no shared state between portals
- `PortalSession` must be **per-portal, per-user** — a partner's session should not be used for another partner's client
- Execution logs must be **client-presentable** — `ExecutionJob` outputs should be readable by non-technical users
- Report templates must be **configurable by portal** — some portals will have different property names for equivalent concepts (handle via `TemplateConfig` overrides)
- The `CoworkInstruction` format is a **future API contract** — it will eventually be consumed by a web-based Cowork interface, not just the desktop app

---

## Handoff Notes for Codex

1. **Start with Part 1** (existence check) — it's the smallest, cleanest change and unblocks everything else
2. **Part 2** (browser session executor) should be built as a standalone package first, tested independently, then wired into the API
3. **Part 3** (report templates) can be built in parallel with Part 2 — no dependencies between them
4. **Part 4** (dashboard agent) depends on both Part 2 and Part 3
5. **Part 5** (Cowork fallback) can be a stub initially — just generate the instruction JSON, don't worry about Cowork pickup yet
6. **Part 6** (Portal Ops wiring) is the integration layer — do this last

**Key files to read before starting:**
- `packages/executor/src/propertiesModule.ts` — understand existing execution pattern
- `packages/hubspot-client/src/hubspotClient.ts` — understand existing API client
- `packages/executor/src/agents/portalAuditAgent.ts` — understand existing agent structure
- `apps/api/src/app.ts` — understand routing patterns
- `docs/agent-delivery-model.md` — understand execution readiness ladder
- `docs/execution-matrix.md` — understand task execution types
- `packages/shared/src/domain.ts` — understand Zod schemas before adding new ones

**Env vars to add:**
```
# No new env vars required — browser session tokens are stored in DB
# Existing HUBSPOT_ACCESS_TOKEN and DATABASE_URL are sufficient
```

**PR checklist before merging:**
- [ ] `pnpm build` passes
- [ ] New packages added to `pnpm-workspace.yaml`
- [ ] Prisma migration created and applied
- [ ] All new endpoints documented in a route comment
- [ ] `ExecutionJob` logs written for every operation (create, skip, error)
- [ ] `dryRun` mode respected in all write operations
- [ ] No `console.log` left in production paths — use structured logger

---

*Spec authored: 26 March 2026*
*Next review: after Codex completes Part 1 + 2*
