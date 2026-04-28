# Sprint 03: Cowork Pickup Endpoint + Perplexity Agent Integration

**Status:** Ready for implementation
**Priority:** P1
**Estimated effort:** 1–2 days
**Depends on:** Sprint 01 + 02
**Authored:** 26 Mar 2026

---

## Goal

Two things in parallel:

1. Wire the `CoworkInstruction` output from the platform so that Cowork (Claude desktop) can pick up pending browser tasks and execute them automatically — closing the Tier 3 loop
2. Add Perplexity as a research agent in the AI routing layer so Portal Ops and other agents can delegate research tasks to it

---

## Part 1: Cowork Instruction Pickup

When the platform generates a `CoworkInstruction` (Tier 3 fallback), it currently stores it on the `ExecutionJob.coworkInstruction` field and returns it from `GET /api/execution-jobs/:id/cowork-instruction`. But nothing picks it up and acts on it.

The fix: a polling endpoint that Cowork checks for pending instructions assigned to a session, and a status-back endpoint so Cowork can report completion.

### New endpoints in `apps/api/src/app.ts`

```typescript
// Cowork polls this to find pending jobs it should execute
GET /api/cowork/pending-instructions
// Returns: array of ExecutionJob records where:
//   status = 'queued' AND executionTier = 3 AND coworkInstruction IS NOT NULL
// Query params: ?portalId=xxx (optional filter)
// Response: [{ jobId, coworkInstruction, createdAt }]

// Cowork calls this when it starts executing a job
POST /api/cowork/instructions/:jobId/start
// Updates ExecutionJob status → 'running'

// Cowork calls this when it finishes
POST /api/cowork/instructions/:jobId/complete
// Body: { success: boolean, output: string, screenshots?: string[] }
// Updates ExecutionJob status → 'complete' or 'failed'
// Writes outputLog from Cowork's output string
```

### New Prisma field on ExecutionJob

```prisma
model ExecutionJob {
  // existing fields...
  coworkSessionId  String?   // which Cowork session claimed this job
  coworkClaimedAt  DateTime? // when it was claimed
}
```

Run migration: `pnpm prisma migrate dev --name add-cowork-session-fields`

### Claim logic (prevent double-execution)

When Cowork calls `/api/cowork/pending-instructions`, mark returned jobs as claimed immediately:
```typescript
// Atomic: only return a job if coworkSessionId is null
// Set coworkSessionId = requestBody.sessionId and coworkClaimedAt = now()
// Use prisma transaction to prevent race conditions
await prisma.$transaction(async (tx) => {
  const jobs = await tx.executionJob.findMany({
    where: { status: 'queued', executionTier: 3, coworkInstruction: { not: null }, coworkSessionId: null }
  });
  for (const job of jobs) {
    await tx.executionJob.update({
      where: { id: job.id },
      data: { coworkSessionId: sessionId, coworkClaimedAt: new Date() }
    });
  }
  return jobs;
});
```

---

## Part 2: Perplexity Research Agent

The platform already has an AI routing layer (`WorkspaceProviderConnection` model, `/settings/ai-routing` UI). Add Perplexity as a supported provider for research tasks.

### New provider type

In `packages/shared/src/domain.ts`, add to the provider enum:
```typescript
export type AIProvider = 'openai' | 'anthropic' | 'perplexity';
```

### New agent definition

Add to the agent registry (or seed file):

```typescript
{
  slug: 'perplexity-researcher',
  name: 'Perplexity Research Agent',
  purpose: 'Researches topics using Perplexity AI with web search. Use for: competitor analysis, market research, HubSpot best practice lookup, industry benchmarks, technology comparisons.',
  serviceFamily: 'research',
  provider: 'perplexity',
  model: 'llama-3.1-sonar-large-128k-online',
  triggerType: 'manual',
  approvalMode: 'no_approval',
  allowedActions: ['web_search', 'write_research_summary']
}
```

### New processor: `apps/api/src/queue/processors/researchAgent.ts`

```typescript
import { JobPayload, JobResult } from '../jobRouter';

export async function runResearchAgent(data: JobPayload): Promise<JobResult> {
  const { query, context } = data.payload as { query: string; context?: string };

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY not set');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant for a HubSpot and RevOps consultancy. Provide concise, accurate, cited answers. Focus on practical implementation guidance.',
        },
        {
          role: 'user',
          content: context ? `Context: ${context}\n\nQuery: ${query}` : query,
        },
      ],
      max_tokens: 2000,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? '';
  const citations = result.citations ?? [];

  return {
    success: true,
    dryRun: false,
    output: { content, citations, query },
  };
}
```

Add `'research'` as a case in `jobRouter.ts`.

### New endpoint

```typescript
POST /api/agents/research
// Body: { query: string, context?: string, projectId?: string }
// Creates ExecutionJob with moduleKey: 'research', queues it
// Returns: { jobId, status: 'queued' }
```

### Env var

Add to `.env.example`:
```
PERPLEXITY_API_KEY=your-key-here
```

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] Cowork pending-instructions endpoint returns Tier 3 jobs correctly
- [ ] Claim transaction prevents double-execution
- [ ] Complete/start endpoints update job status
- [ ] Perplexity processor calls API and writes research output to outputLog
- [ ] Research job can be triggered via `POST /api/agents/research`
- [ ] `PERPLEXITY_API_KEY` added to `.env.example`
- [ ] Prisma migration runs cleanly
