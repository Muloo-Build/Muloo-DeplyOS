# Filesystem Layer Migration Report

> Inventory pass for `DeployOS_BugFixes_Prompt.md` Bug 3 (Step 1). No code changes yet — this is the baseline before migration.

## What's there

`@muloo/file-system` is the original JSON-on-disk persistence layer. It pre-dates Prisma. Today both layers run side by side, with Prisma as the active production store and the FS layer mostly serving template/seed data, AI execution artefacts, and a few legacy paths the API never fully migrated.

### Package shape

| File | Lines | Purpose |
|---|---|---|
| `packages/file-system/src/projects.ts` | 978 | The big one. Reads/writes `data/projects/{id}.json`, holds its own `PrismaClient` for hybrid paths. |
| `packages/file-system/src/executions.ts` | 338 | AI execution records — `data/executions/{id}.json`. |
| `packages/file-system/src/validation.ts` | 395 | Validates project JSON against zod schemas in `@muloo/shared`. |
| `packages/file-system/src/modules.ts` | 121 | HubSpot module catalogue helpers. |
| `packages/file-system/src/summaries.ts` | 95 | Project summary composition. |
| `packages/file-system/src/json.ts` | 65 | Generic file-IO helpers. |
| `packages/file-system/src/templates.ts` | 48 | `data/templates/*.json` reads. |

Total: 2,047 lines. Modules using `node:fs`: `projects.ts`, `executions.ts`, `templates.ts`, `json.ts`. Module using `PrismaClient` directly: `projects.ts`.

### Data on disk (current snapshot)

```
data/
├── projects/    5 JSON files  (last modified Mar 17, 2026 — stale)
├── executions/  7 JSON files  (last modified Mar 22, 2026 — stale)
└── templates/   3 JSON files  (last modified Mar 17, 2026 — stale)
```

All file mtimes are >5 weeks old. None of the live operational flows (project creation, quote lifecycle, retainer ledger, runs feed) appear to be writing to disk anymore.

### Active call sites

| Function | Call sites in `app.ts`/`server.ts` | Disposition |
|---|---|---|
| `createProjectFromTemplate` | 2 | **Active dual-write candidate.** Project creation already writes to Prisma; verify FS path is dead. |
| `loadAllExecutionRecords` | 2 | **Legacy read.** Replace with `loadWorkflowRuns` (existing Prisma path). |
| `loadExecutionById` | 2 | **Legacy read.** Replace with `loadWorkflowRunById`. |
| `loadExecutionSteps` | 2 | **Legacy read.** No clear Prisma equivalent yet — schema work needed before removal. |
| `loadAllTemplates` | 2 | **Seed data.** Templates are mostly static — keep as cached read for now, document. |
| `loadProjectById` | 3 | **Legacy read.** All project reads should hit Prisma `Project` directly. |
| `loadProjectDiscoveryById` | 3 | **Legacy read.** Discovery data lives in `DiscoverySubmission` / `DiscoverySummary` Prisma models. Migrate. |
| `loadProjectDesignById` | 5 | **Legacy read.** Design state stored across multiple Prisma tables — needs a small adapter. |
| `loadProjectExecutions` | 3 | **Legacy read.** Replace with `WorkflowRun.findMany({where:{projectId}})`. |
| `loadProjectModuleDetail` | 3 | **Legacy read.** HubSpot module catalogue is mostly static; keep as cache. |
| `loadProjectReadinessById` | 6 | **Legacy read.** Validation roll-up — move into a server function. |
| `loadProjectSummaryById` | 3 | **Legacy read.** Summaries are held in Prisma `Project` columns and `DiscoverySummary`. |
| `loadTemplateById` | 2 | **Seed data.** Same as `loadAllTemplates`. |
| `summarizeProject` | 9 | **Compute.** Reads many sources. Should be a Prisma-backed function in `server.ts`. High call-site count makes this the highest-impact migration. |
| `summarizeProjectModules` | 3 | **Compute.** Same family as above. |
| `updateProjectDiscoverySection` | 2 | **Active dual-write candidate.** Confirm whether either consumer is reachable in production. |
| `updateProjectLifecycleDesign` | 2 | **Active dual-write candidate.** |
| `updateProjectMetadata` | 2 | **Active dual-write candidate.** Project metadata edits flow through Prisma — verify. |
| `updateProjectPipelinesDesign` | 2 | **Active dual-write candidate.** |
| `updateProjectPropertiesDesign` | 2 | **Active dual-write candidate.** |
| `updateProjectScope` | 2 | **Active dual-write candidate.** |
| `validateAllProjects` | 2 | **Validation.** Compares JSON to schema — only useful for FS-resident data. Will be obsolete once migration completes. |
| `validateProjectById` | 7 | **Validation.** Same as above. Highest-impact validation surface — replace with a Prisma-backed validator. |

Two extra call sites in `apps/cli/src/index.ts:24` confirmed via grep.

### Risk by category

**Cache (keep, document):** templates and module catalogue. Read-only seed data. Low risk.

**Legacy read fallback (5 functions, 19 call sites):** every `load*` reads from JSON, returning data that today exists in Prisma. **Action:** for each, add a Prisma equivalent in `server.ts`, migrate call sites, delete the FS function.

**Active dual-write candidates (7 update* functions, 14 call sites):** these are the actual risk. If any is still writing to disk while production reads from Prisma, edits may be silently lost. **Action (per function):**
1. Add structured logging at every call site to confirm which is reachable from real user flows.
2. For unreachable ones: delete.
3. For reachable ones: stop the FS write, ensure Prisma write covers it, run a one-shot reconciliation script.

**Compute (`summarize*`, `validate*`):** these read from many sources. Migrating them is the single biggest piece of the work. They're called from many surfaces (Command Centre, Prepare workspace, project landing). **Action:** rewrite as Prisma-only `server.ts` functions; replace call sites in batches.

### Recommended migration order

1. **Disposition pass.** For each of the 14 dual-write call sites, add `console.log("[fs-layer]", funcName, args)` and ship to staging for a week. Real call counts decide what's reachable.
2. **Delete the orphans.** Anything with zero hits over the observation window goes.
3. **Replace the loaders** (lowest risk first): templates and modules first (cache), then `loadProject*` family (read-only paths), then `loadExecution*`.
4. **Replace the validators.** `validateProjectById` → Prisma-backed validator returning the same shape.
5. **Replace the compute.** `summarizeProject` and friends — biggest surface, save for last.
6. **Remove the dual-writes.** Each `update*` migrated and confirmed before deletion.
7. **Rip out the package.** Remove `@muloo/file-system` from `apps/api`, `apps/cli`, root workspace deps. Keep the package source in `packages/` until the next major release in case anything is missed.

### Acceptance for the migration as a whole

- `grep -rn "@muloo/file-system" apps/api/src apps/cli/src` returns zero hits.
- `data/` directory archived (move to `archive/data-2026-04-29/`) or deleted.
- All six audit journeys (project create, blueprint, client portal, time/retainers, integrations, ops) pass smoke tests against Prisma-only paths.

### What's done in this pass

Step 1 inventory only. No code changes. Steps 2 and 3 of `DeployOS_BugFixes_Prompt.md` Bug 3 carry to a later session — they're large enough to warrant their own week per the Master Queue (Row 40).
