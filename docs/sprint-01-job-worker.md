# Sprint 01: Background Job Worker

**Status:** Ready for implementation
**Priority:** P0 — unblocks all execution capability
**Estimated effort:** 1–2 days
**Assigned to:** Codex
**Authored:** 26 Mar 2026

---

## Problem

Every execution action in the platform — property creation, portal audit, dashboard assembly, workflow runs — hits an API endpoint that creates an `ExecutionJob` record with `status: "queued"` and returns `202 Accepted`. Then nothing happens. There is no background worker to pick up and process those jobs.

The entire execution layer of the platform is blocked by this single missing piece.

---

## Goal

Implement a BullMQ-based background job worker that:
1. Picks up `ExecutionJob` records when they enter `queued` status
2. Routes them to the correct executor based on `moduleKey`
3. Updates job status in real time (`queued → running → complete / failed`)
4. Logs all output to `ExecutionJob.outputLog` and errors to `ExecutionJob.errorLog`
5. Supports retry on transient failures
6. Respects `dryRun` mode — plans but does not execute writes

---

## Tech Choice: BullMQ

Use **BullMQ** with Redis as the backing store. It is the standard choice for Node.js job queues, supports retries, concurrency, priorities, delayed jobs, and has good TypeScript support.

Redis is already a common dependency in Railway deployments. Add it as an env var.

**Install:**
```bash
pnpm add bullmq ioredis --filter @muloo/api
```

---

## Architecture

```
API endpoint
  → creates ExecutionJob (status: queued)
  → adds job to BullMQ queue (jobId = ExecutionJob.id)

BullMQ Worker (separate process or same process)
  → picks up job from queue
  → sets ExecutionJob status: running
  → routes to correct executor module by moduleKey
  → executor runs (respects dryRun flag)
  → sets ExecutionJob status: complete or failed
  → writes output/error log
  → emits completion event (SSE or webhook, future sprint)
```

---

## Files to Create / Modify

### New files
```
apps/api/src/
├── queue/
│   ├── index.ts              # Queue and connection exports
│   ├── worker.ts             # BullMQ worker definition
│   ├── jobRouter.ts          # Routes moduleKey → executor function
│   └── processors/
│       ├── portalAudit.ts    # Wraps portalAuditAgent
│       ├── propertyApply.ts  # Wraps propertiesModule apply
│       ├── dashboardBuild.ts # Wraps marketingDashboardAgent
│       └── genericExecutor.ts # Fallback for unrecognised moduleKeys
```

### Modified files
```
apps/api/src/app.ts           # Start worker on server boot, add SSE status endpoint
apps/api/src/server.ts        # Pass queue instance to execution endpoints
.env.example                  # Add REDIS_URL
apps/api/package.json         # Add bullmq + ioredis dependencies
```

---

## Implementation

### `apps/api/src/queue/index.ts`

```typescript
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
});

export const executionQueue = new Queue('execution-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const queueEvents = new QueueEvents('execution-jobs', { connection });
```

### `apps/api/src/queue/worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { connection } from './index';
import { routeJob } from './jobRouter';
import { prisma } from '../prisma'; // use existing prisma instance

export function startWorker() {
  const worker = new Worker(
    'execution-jobs',
    async (job: Job) => {
      const executionJobId = job.data.executionJobId as string;

      // Mark as running
      await prisma.executionJob.update({
        where: { id: executionJobId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      try {
        const result = await routeJob(job.data);

        await prisma.executionJob.update({
          where: { id: executionJobId },
          data: {
            status: result.dryRun ? 'dry_run_complete' : 'complete',
            resultStatus: result.success ? 'success' : 'partial',
            outputLog: JSON.stringify(result.output, null, 2),
            completedAt: new Date(),
          },
        });

        return result;
      } catch (err: any) {
        await prisma.executionJob.update({
          where: { id: executionJobId },
          data: {
            status: 'failed',
            resultStatus: 'error',
            errorLog: err?.message ?? String(err),
            completedAt: new Date(),
          },
        });
        throw err; // rethrow so BullMQ handles retry
      }
    },
    {
      connection,
      concurrency: 3, // process up to 3 jobs at once
    }
  );

  worker.on('completed', (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
```

### `apps/api/src/queue/jobRouter.ts`

```typescript
import { runPortalAudit } from './processors/portalAudit';
import { runPropertyApply } from './processors/propertyApply';
import { runDashboardBuild } from './processors/dashboardBuild';

export interface JobPayload {
  executionJobId: string;
  moduleKey: string;
  projectId?: string;
  portalId?: string;
  sessionId?: string;
  dryRun?: boolean;
  payload?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  dryRun: boolean;
  output: unknown;
}

export async function routeJob(data: JobPayload): Promise<JobResult> {
  switch (data.moduleKey) {
    case 'portal_audit':
      return runPortalAudit(data);
    case 'property_apply':
      return runPropertyApply(data);
    case 'dashboard_build':
      return runDashboardBuild(data);
    default:
      throw new Error(`Unknown moduleKey: ${data.moduleKey}`);
  }
}
```

### `apps/api/src/queue/processors/portalAudit.ts`

```typescript
import { JobPayload, JobResult } from '../jobRouter';
import { runPortalAuditAgent } from '@muloo/executor'; // existing agent

export async function runPortalAudit(data: JobPayload): Promise<JobResult> {
  if (!data.portalId || !data.projectId) {
    throw new Error('portalId and projectId are required for portal_audit');
  }

  const result = await runPortalAuditAgent({
    portalId: data.portalId,
    projectId: data.projectId,
    dryRun: data.dryRun ?? false,
  });

  return {
    success: true,
    dryRun: data.dryRun ?? false,
    output: result,
  };
}
```

### `apps/api/src/queue/processors/propertyApply.ts`

```typescript
import { JobPayload, JobResult } from '../jobRouter';
import { executePropertyApply } from '@muloo/executor';

export async function runPropertyApply(data: JobPayload): Promise<JobResult> {
  if (!data.projectId) throw new Error('projectId required for property_apply');

  const result = await executePropertyApply({
    projectId: data.projectId,
    dryRun: data.dryRun ?? false,
    payload: data.payload,
  });

  return {
    success: result.success,
    dryRun: data.dryRun ?? false,
    output: result,
  };
}
```

### `apps/api/src/queue/processors/dashboardBuild.ts`

```typescript
import { JobPayload, JobResult } from '../jobRouter';
import { runMarketingDashboardAgent } from '@muloo/executor';

export async function runDashboardBuild(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) throw new Error('portalId required for dashboard_build');

  const result = await runMarketingDashboardAgent({
    portalId: data.portalId,
    projectId: data.projectId,
    sessionId: data.sessionId,
    dryRun: data.dryRun ?? false,
    ...(data.payload ?? {}),
  });

  return {
    success: result.status !== 'error',
    dryRun: data.dryRun ?? false,
    output: result,
  };
}
```

---

## Wire Queue Into Existing Execution Endpoints

In `apps/api/src/app.ts`, find all places that currently do:
```typescript
// Currently: create job and return 202, nothing executes
await prisma.executionJob.create({ data: { ..., status: 'queued' } });
return c.json({ status: 'queued' }, 202);
```

Replace with:
```typescript
const job = await prisma.executionJob.create({
  data: { ..., status: 'queued' }
});

// Add to BullMQ queue — worker picks this up immediately
await executionQueue.add(
  job.moduleKey,
  {
    executionJobId: job.id,
    moduleKey: job.moduleKey,
    projectId: job.projectId,
    portalId: job.payload?.portalId,
    sessionId: job.payload?.sessionId,
    dryRun: job.mode === 'dry-run',
    payload: job.payload,
  },
  { jobId: job.id } // use same ID for traceability
);

return c.json({ jobId: job.id, status: 'queued' }, 202);
```

---

## Start Worker on Server Boot

At the bottom of `apps/api/src/app.ts` (or in `server.ts` startup):

```typescript
import { startWorker } from './queue/worker';

// Start the background job worker
if (process.env.NODE_ENV !== 'test') {
  startWorker();
  console.log('[worker] BullMQ execution worker started');
}
```

---

## New API Endpoint: Job Status Polling

Add to `apps/api/src/app.ts`:

```typescript
// Poll job status
app.get('/api/execution-jobs/:id/status', async (c) => {
  const job = await prisma.executionJob.findUnique({
    where: { id: c.req.param('id') },
    select: {
      id: true,
      status: true,
      resultStatus: true,
      moduleKey: true,
      mode: true,
      startedAt: true,
      completedAt: true,
      outputLog: true,
      errorLog: true,
      executionTier: true,
      coworkInstruction: true,
    },
  });

  if (!job) return c.json({ error: 'Job not found' }, 404);
  return c.json(job);
});
```

The frontend can poll this endpoint every 2 seconds to show live job progress. SSE is a future sprint.

---

## Prisma Schema Updates

Add missing timestamp fields to `ExecutionJob` if not already present:

```prisma
model ExecutionJob {
  // ... existing fields ...
  startedAt    DateTime?
  completedAt  DateTime?
}
```

Run migration:
```bash
cd apps/api && pnpm prisma migrate dev --name add-job-timestamps
```

---

## Environment Variables

Add to `.env.example`:
```
# Redis (required for job queue)
REDIS_URL=redis://localhost:6379
```

For Railway deployment, provision a Redis instance and set `REDIS_URL` in the environment.

---

## Prisma ExecutionJob Status Values

Ensure these status strings are used consistently:

| Status | Meaning |
|---|---|
| `queued` | In queue, not started |
| `running` | Currently executing |
| `complete` | Finished successfully |
| `dry_run_complete` | Dry run finished, no writes made |
| `failed` | Execution failed, see errorLog |
| `cancelled` | Manually cancelled (future) |

---

## Testing

### Manual test flow
1. Start server with Redis running
2. Hit `POST /api/agents/marketing-dashboard` with `{ portalId: "146339210", dryRun: true }`
3. Get back `{ jobId, status: "queued" }`
4. Poll `GET /api/execution-jobs/:id/status` every 2s
5. Watch status move: `queued → running → dry_run_complete`
6. Check `outputLog` for the dry-run plan

### Unit tests
- `apps/api/src/queue/__tests__/jobRouter.test.ts`
  - Mock each processor, verify routing by moduleKey
  - Test unknown moduleKey throws
- `apps/api/src/queue/__tests__/worker.test.ts`
  - Mock prisma, verify status transitions
  - Test failure path updates status to `failed` and logs error

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] `bullmq` and `ioredis` added to `apps/api/package.json`
- [ ] `REDIS_URL` added to `.env.example`
- [ ] Worker starts on server boot (confirmed in logs)
- [ ] All existing `202 queued` endpoints now enqueue to BullMQ
- [ ] `GET /api/execution-jobs/:id/status` endpoint added
- [ ] Prisma migration created for `startedAt` / `completedAt`
- [ ] `dryRun` flag respected in all processors
- [ ] No job silently fails without updating `ExecutionJob.status`

---

## What This Unlocks

Once this is live:
- Portal audit jobs actually run when triggered from the UI
- Property apply jobs execute against HubSpot
- Marketing dashboard agent runs end-to-end
- The frontend can show real-time job status
- Every subsequent sprint has a working execution backbone to build on

**This is the single most important piece of infrastructure in the platform.**

---

*Spec authored: 26 Mar 2026*
