# Sprint 02: Complete Dashboard Agent + HubSpot Write Operations

**Status:** Ready for implementation
**Priority:** P0
**Estimated effort:** 2–3 days
**Depends on:** Sprint 01 (job worker) deployed and Redis running
**Authored:** 26 Mar 2026

---

## Goal

Complete the `marketingDashboardAgent` execution body so it actually builds a dashboard in HubSpot end-to-end. Expand `hubspotClient` and `BrowserSessionExecutor` to cover all write operations needed. Prove the full loop works against epiuse portal (146339210) in dry-run, then live.

---

## Part 1: Fix marketingDashboardAgent execution body

### File: `packages/executor/src/agents/marketingDashboardAgent.ts`

The agent was scaffolded in the previous sprint but the main `runMarketingDashboardAgent()` function body was cut off at line ~144. Complete it.

**Full execution flow:**

```typescript
export async function runMarketingDashboardAgent(
  input: MarketingDashboardInput
): Promise<MarketingDashboardOutput> {

  // 1. AUDIT PHASE
  // For each template in TemplateEngine.getAllTemplates():
  //   call getPropertyByName() for each requiredProperty
  //   build: { templateId, buildable: boolean, missingProps: string[] }

  // 2. DETERMINE EXECUTION TIER
  // Check prisma.portalSession for valid session where portalId matches
  // If found: tier = 2 (BrowserSessionExecutor)
  // If not: tier = 4 (CoworkInstruction fallback)
  // If dryRun: plan only, no writes regardless of tier

  // 3. PLAN PHASE
  // For each buildable template: build(config) → ReportDefinition
  // For each unbuildable template: generate CoworkStep for manual creation
  // If dryRun: return plan without executing

  // 4. EXECUTE PHASE (tier 2 only)
  // For each buildable template:
  //   executor.createReport(reportDef)
  //   log reportId to reportsCreated array
  //   on error: log failure, continue (don't abort)

  // 5. ASSEMBLE PHASE (tier 2 only)
  // executor.createDashboard({ name: dashboardName, portalId })
  // for each created reportId: executor.addReportToDashboard(dashboardId, reportId)

  // 6. HANDOVER PHASE
  // Return MarketingDashboardOutput with:
  //   status: complete | partial | plan_only | error
  //   dashboardUrl (if created)
  //   reportsCreated array
  //   manualSteps (CoworkInstructions for failed/skipped reports)
  //   summary string
}
```

**If dryRun is true**, skip phases 4 and 5. Return status `plan_only` with the full plan of what would be created.

---

## Part 2: Expand BrowserSessionExecutor with report + dashboard methods

### File: `packages/browser-session-executor/src/BrowserSessionExecutor.ts`

Add these methods:

```typescript
async createReport(reportDef: ReportDefinition): Promise<ExecutionResult>
// POST /api/reports/v2/reports?portalId={id}
// Body: reportDef
// Returns: { reportId, name, reportUrl }

async createDashboard(opts: { name: string; portalId: string }): Promise<ExecutionResult>
// POST /api/reports/v2/dashboards?portalId={id}
// Body: { name, filters: [] }
// Returns: { dashboardId, dashboardUrl }

async addReportToDashboard(dashboardId: string, reportId: string): Promise<ExecutionResult>
// GET current dashboard, add reportId to reports array, PUT back
// GET: /api/reports/v2/dashboards/{dashboardId}?portalId={id}
// PUT: /api/reports/v2/dashboards/{dashboardId}?portalId={id}
// Body: { ...existingDashboard, reports: [...existing, { id: reportId }] }

async listDashboards(): Promise<ExecutionResult>
// GET /api/reports/v2/dashboards?portalId={id}
// Returns: array of { dashboardId, name, reportCount }
```

All methods must:
- Use `this.headers` (includes CSRF token)
- Return `ExecutionResult` with `{ success, action, data, error, tier: 'browser_session' }`
- Handle 4xx/5xx gracefully — never throw, always return `success: false` with error message

---

## Part 3: Expand hubspotClient write operations

### File: `packages/hubspot-client/src/hubspotClient.ts`

Add these write methods using the official HubSpot Node.js client (`@hubspot/api-client`):

```typescript
// Properties
async createProperty(objectType: string, def: PropertyDefinition): Promise<HubSpotProperty>
async updateProperty(objectType: string, name: string, updates: Partial<PropertyDefinition>): Promise<HubSpotProperty>

// Pipelines
async createPipeline(objectType: string, pipeline: PipelineDefinition): Promise<Pipeline>
async updatePipelineStage(objectType: string, pipelineId: string, stageId: string, updates: object): Promise<PipelineStage>

// Contacts / Deals (basic record ops)
async updateContactProperty(contactId: string, properties: Record<string, string>): Promise<void>
async searchContacts(filter: ContactFilter): Promise<ContactSearchResult>
```

Each method should check that `this.accessToken` is set and throw a clear error if not.

---

## Part 4: Wire the dashboard build processor

### File: `apps/api/src/queue/processors/dashboardBuild.ts`

Complete the stub — call `runMarketingDashboardAgent` for real:

```typescript
export async function runDashboardBuild(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) throw new Error('portalId required for dashboard_build');

  const result = await runMarketingDashboardAgent({
    portalId: data.portalId,
    projectId: data.projectId,
    sessionId: data.sessionId,
    dryRun: data.dryRun ?? false,
    dashboardName: (data.payload?.dashboardName as string) ?? 'Marketing Dashboard',
    sectionsToInclude: data.payload?.sectionsToInclude as DashboardSection[] | undefined,
  });

  return {
    success: result.status !== 'error',
    dryRun: data.dryRun ?? false,
    output: result,
  };
}
```

---

## Part 5: Integration test

Create `tests/dashboard-dry-run.test.ts`:

```typescript
// Test the full dry-run flow against epiuse portal
// POST /api/agents/marketing-dashboard { portalId: '146339210', dryRun: true }
// Poll GET /api/execution-jobs/:id/status until status = 'dry_run_complete'
// Assert: outputLog contains plan_only result with ≥5 templates identified
// Assert: no HubSpot write calls were made
```

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] `runMarketingDashboardAgent` completes full flow without hanging
- [ ] `dryRun: true` returns plan, no HubSpot writes
- [ ] `BrowserSessionExecutor.createReport/createDashboard/addReportToDashboard` implemented
- [ ] All new hubspotClient methods have error handling
- [ ] Integration test passes in dry-run mode
- [ ] `ExecutionJob.outputLog` contains structured result (not empty)
