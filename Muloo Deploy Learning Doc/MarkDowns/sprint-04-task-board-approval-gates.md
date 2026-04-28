# Sprint 04: Task Execution Board + Approval Gates

**Status:** Ready for implementation
**Priority:** P1
**Estimated effort:** 2–3 days
**Depends on:** Sprint 01
**Authored:** 26 Mar 2026

---

## Goal

Make the delivery board usable end-to-end: tasks move through statuses, execution jobs can be triggered from the board, and approval gates block writes until a human signs off. This is what makes the platform usable by someone other than Jarrud.

---

## Part 1: Task Status Transitions API

Ensure all task status transitions are enforced server-side.

### Valid transitions

```
backlog → todo
todo → in_progress
in_progress → blocked
in_progress → waiting_on_client
in_progress → done (only if approvalRequired = false OR approval granted)
waiting_on_client → in_progress
blocked → in_progress
done → in_progress (reopen)
```

### Endpoint: `PATCH /api/projects/:projectId/tasks/:taskId/status`

```typescript
// Body: { status: TaskStatus }
// 1. Load task
// 2. Check transition is valid (throw 400 if not)
// 3. If transitioning to 'done' and task.approvalRequired:
//    Check if an approval exists for this task (TaskApproval model)
//    If not: throw 403 "This task requires approval before completion"
// 4. Update task.status
// 5. If task.executionType = 'api' and status → 'in_progress':
//    Auto-create and queue an ExecutionJob for this task
// Return: updated task
```

### Auto-trigger execution

When a task with `executionType = 'api'` moves to `in_progress`, automatically create and queue an `ExecutionJob`:

```typescript
if (task.executionType === 'api' && newStatus === 'in_progress') {
  const job = await prisma.executionJob.create({
    data: {
      projectId,
      taskId: task.id,
      moduleKey: task.agentModuleKey ?? 'generic',
      mode: 'apply',
      status: 'queued',
      payload: task.executionPayload ?? {},
    }
  });
  await executionQueue.add(job.moduleKey, {
    executionJobId: job.id,
    moduleKey: job.moduleKey,
    projectId,
    ...job.payload,
  }, { jobId: job.id });
}
```

Add `agentModuleKey String?` and `executionPayload Json?` to the `Task` model if not present.

---

## Part 2: Approval Gates

### New Prisma model: `TaskApproval`

```prisma
model TaskApproval {
  id          String   @id @default(cuid())
  taskId      String
  projectId   String
  requestedAt DateTime @default(now())
  approvedAt  DateTime?
  rejectedAt  DateTime?
  approvedBy  String?  // user email
  rejectedBy  String?
  notes       String?
  status      String   @default("pending") // pending | approved | rejected

  task        Task     @relation(fields: [taskId], references: [id])
}
```

Run migration: `pnpm prisma migrate dev --name add-task-approval`

### Endpoints

```typescript
// Request approval for a task
POST /api/projects/:projectId/tasks/:taskId/request-approval
// Creates TaskApproval record with status: 'pending'
// Returns: { approvalId }

// Approve a task (internal user only)
POST /api/projects/:projectId/tasks/:taskId/approve
// Body: { notes?: string }
// Sets approval.status = 'approved', approvedAt, approvedBy
// Returns: { approved: true }

// Reject a task
POST /api/projects/:projectId/tasks/:taskId/reject
// Body: { notes: string }
// Sets approval.status = 'rejected', rejectedAt, rejectedBy
// Returns: { rejected: true }

// Get approval status
GET /api/projects/:projectId/tasks/:taskId/approval
// Returns: TaskApproval record or null
```

---

## Part 3: Execution Job Trigger from Board

### Endpoint: `POST /api/projects/:projectId/tasks/:taskId/execute`

```typescript
// Body: { dryRun?: boolean, sessionId?: string }
// 1. Load task, check it has executionType = 'api' or 'cowork'
// 2. Check task.executionReadiness — must not be 'not_ready'
// 3. If task.approvalRequired and no approval: throw 403
// 4. Create ExecutionJob and queue it
// 5. Set task.status = 'in_progress'
// Return: { jobId, status: 'queued' }
```

---

## Part 4: Task Board API (list with execution status)

### Endpoint: `GET /api/projects/:projectId/tasks/board`

Returns tasks grouped by status column, with their latest execution job status embedded:

```typescript
// Response:
{
  columns: {
    backlog: Task[],
    todo: Task[],
    in_progress: Task[],
    waiting_on_client: Task[],
    blocked: Task[],
    done: Task[]
  },
  executionJobs: Record<taskId, { jobId, status, completedAt }>
}
```

---

## Part 5: Frontend board page update

### File: `apps/web/app/projects/[id]/delivery/page.tsx`

Update the delivery board page to:

1. Render tasks in columns by status
2. Show execution job status badge on tasks that have active jobs (poll `GET /api/execution-jobs/:id/status` every 3s)
3. "Run" button on tasks with `executionType = 'api'` and `executionReadiness` of `ready` or `ready_with_review`
4. "Approve" button on tasks with `approvalRequired = true` and pending approval
5. Clicking "Run" calls `POST .../execute` and shows loading state

Keep it simple — no drag-and-drop required in this sprint. Status changes via dropdown on each task card.

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] All task status transitions enforced server-side
- [ ] Tasks with `executionType = 'api'` auto-queue jobs when moved to in_progress
- [ ] Approval gate blocks `done` transition when `approvalRequired = true`
- [ ] `POST .../execute` creates and queues job
- [ ] `GET .../board` returns tasks grouped by status with job status
- [ ] Frontend delivery page renders columns and execution status badges
- [ ] "Run" button calls execute endpoint
- [ ] Prisma migrations run cleanly
