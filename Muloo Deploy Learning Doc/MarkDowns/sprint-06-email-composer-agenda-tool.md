# Sprint 06: Simplified Email Composer + Agenda Builder

**Status:** Ready for implementation
**Priority:** P1
**Estimated effort:** 1–2 days
**Depends on:** Nothing — standalone UI sprint
**Authored:** 26 Mar 2026

---

## Feature 1: Simplified Email Composer

### Problem
The current Project Email Composer has too many fields: AI provider, model, email intent dropdown, extra instruction field, saved client contacts, To/CC/Subject fields, and multiple action buttons. It's cognitive overhead when all Jarrud needs is: write notes or dictate → AI drafts the email using project context → copy and send.

### What to keep
- Plain text area (the body input)
- "Voice dictation" button
- "AI generate email" button (renamed to just "Draft email")
- "Copy email" button

### What to remove
- Email intent dropdown
- AI provider dropdown
- Model dropdown
- Extra instruction field
- Saved client contacts section
- To / CC fields
- Subject field
- "Clean up with AI" button (merge this behaviour into "Draft email")
- "Send email" button

### New behaviour

**Text area:** Plain, no label. Placeholder: `"Write notes here or use voice dictation. AI will use the project context to draft your email."`

**Voice dictation button:** Unchanged — triggers browser speech recognition, transcribes into the text area.

**Draft email button:** Calls `POST /api/projects/:projectId/email/draft`
- Sends: `{ notes: string }` (content of text area)
- API assembles project context: client name, project type, hubs in scope, platform packaging, quick wins, blueprint summary, outstanding tasks
- System prompt: `"You are writing a professional but warm email on behalf of a HubSpot consultant. Use the project context provided and the user's notes to draft a concise, friendly email. Do not add fluff. Sound like a human consultant, not a corporation."`
- Returns: `{ draft: string }`
- Draft replaces the text area content

**Copy button:** Copies text area content to clipboard. Shows "Copied!" for 2 seconds.

### API endpoint: `POST /api/projects/:projectId/email/draft`

```typescript
app.post('/api/projects/:projectId/email/draft', requireAuth, async (c) => {
  const { notes } = await c.req.json();
  const projectId = c.req.param('projectId');

  // Load project context
  const project = await loadProjectById(projectId);
  const context = buildEmailContext(project); // see below

  const aiProvider = getWorkspaceAIProvider(); // use workspace default

  const draft = await aiProvider.complete({
    system: `You are writing a professional but warm email on behalf of a HubSpot consultant named ${project.owner}.
Use the project context to make the email specific and relevant.
Keep it concise, direct, and human. No corporate filler.
Project context: ${context}`,
    user: notes || 'Draft a brief project update email.',
  });

  return c.json({ draft });
});

function buildEmailContext(project: Project): string {
  return [
    `Client: ${project.clientName}`,
    `Project: ${project.name} (${project.projectType})`,
    `Hubs in scope: ${project.hubsInScope?.join(', ')}`,
    `Platform: ${project.platformPackaging}`,
    `Status: ${project.status}`,
    project.quickWins?.length ? `Quick wins identified: ${project.quickWins.slice(0,3).map(q => q.title).join('; ')}` : '',
    project.blueprintGenerated ? `Blueprint generated, tasks in delivery board` : `Blueprint not yet generated`,
  ].filter(Boolean).join('\n');
}
```

### UI component location

Find the existing Project Email Composer component. It is likely in one of:
- `apps/web/app/projects/[id]/page.tsx` (inline)
- `apps/web/components/projects/EmailComposer.tsx` or similar

Replace the entire component with the simplified version. Do not delete the old API endpoints — just stop using them from the UI.

---

## Feature 2: Agenda Builder

### Overview

A new collapsible section on the project page that lets Jarrud specify a session type, optional date/duration, and generate a structured agenda using all available project data as context. Output renders inline with a copy-to-clipboard button.

### Session types supported
- Workshop / Onboarding Session
- Discovery Session
- Kick-off Meeting
- Check-in / Status Call

### UI

Add a new collapsible section to the project page below the email composer (or as a separate tab — follow existing layout conventions):

```
[ Agenda Builder ]  ▼

Session type:   [ Dropdown: Workshop / Discovery / Kick-off / Check-in ]
Date:           [ Optional date input ]
Duration:       [ Optional: 1hr / 2hrs / Half day / Full day ]
Notes:          [ Optional short text: "Focus on pipeline setup and reporting" ]

[ Generate Agenda ]

--- OUTPUT (renders below after generation) ---
[ agenda text rendered in a read-only styled block ]
[ Copy agenda ]
```

### API endpoint: `POST /api/projects/:projectId/agenda/generate`

```typescript
app.post('/api/projects/:projectId/agenda/generate', requireAuth, async (c) => {
  const { sessionType, date, duration, notes } = await c.req.json();
  const projectId = c.req.param('projectId');

  const project = await loadProjectById(projectId);
  const context = buildAgendaContext(project);

  const aiProvider = getWorkspaceAIProvider();

  const agenda = await aiProvider.complete({
    system: `You are a HubSpot implementation consultant building a structured meeting agenda.
Use the project context below to create a relevant, time-boxed agenda.
Make it practical — specific to what this project actually needs.
Format: plain text with time slots, section titles, and brief bullet points per section.
Do not pad it. Every agenda item should earn its place.

Project context:
${context}`,
    user: buildAgendaPrompt({ sessionType, date, duration, notes }),
  });

  return c.json({ agenda });
});

function buildAgendaContext(project: Project): string {
  const sections = [
    `Client: ${project.clientName}`,
    `Project type: ${project.projectType}`,
    `Hubs in scope: ${project.hubsInScope?.join(', ')}`,
    `Platform tier: ${project.platformPackaging}`,
    `Status: ${project.status}`,
  ];

  if (project.quickWins?.length) {
    sections.push(`Quick wins identified:\n${project.quickWins.map(q => `- ${q.title}`).join('\n')}`);
  }

  if (project.blueprint?.phases?.length) {
    const openTasks = project.blueprint.phases
      .flatMap(p => p.tasks ?? [])
      .filter(t => t.status !== 'done')
      .slice(0, 8)
      .map(t => `- ${t.title}`);
    if (openTasks.length) {
      sections.push(`Outstanding blueprint tasks:\n${openTasks.join('\n')}`);
    }
  }

  if (project.discoveryProgress) {
    const open = project.discoveryProgress.sessions?.filter(s => s.status !== 'complete') ?? [];
    if (open.length) {
      sections.push(`Open discovery areas: ${open.map(s => s.title).join(', ')}`);
    }
  }

  if (project.inputs?.length) {
    const answered = project.inputs.filter(i => i.answer);
    if (answered.length) {
      sections.push(`Client inputs captured:\n${answered.slice(0,5).map(i => `- ${i.question}: ${i.answer}`).join('\n')}`);
    }
  }

  if (project.prepareNotes) {
    sections.push(`Prepare / context notes: ${project.prepareNotes.substring(0, 400)}`);
  }

  return sections.join('\n\n');
}

function buildAgendaPrompt({ sessionType, date, duration, notes }: AgendaInput): string {
  const parts = [`Build an agenda for a ${sessionType}.`];
  if (date) parts.push(`Scheduled for: ${date}.`);
  if (duration) parts.push(`Duration: ${duration}.`);
  if (notes) parts.push(`Additional focus: ${notes}.`);
  parts.push('Use the project context to make every agenda item specific and relevant.');
  return parts.join(' ');
}
```

### Context sources (all pulled from project data)

| Source | What it contributes |
|---|---|
| Blueprint / task list | Outstanding work to cover in the session |
| Quick wins | High-priority items to prioritise early |
| Discovery progress | Open discovery areas that need to be addressed |
| Hubs in scope + platform packaging | Determines which topics are relevant |
| Project inputs | Client's own answers — use to personalise |
| Prepare notes | Jarrud's pre-session context and notes |

### Output format (example for Discovery session)

```
Discovery Session — EPIUSE ZA
HubSpot Foundation Phase 2
Duration: 2 hours

00:00 – 00:10  Welcome & introductions
  - Confirm attendees and roles
  - Overview of today's goals

00:10 – 00:30  Current state walkthrough
  - Existing HubSpot usage (Sales Hub Pro, Service Hub Pro)
  - Pipeline structure: main sales + operational pipeline
  - Current reporting setup

00:30 – 00:55  Pain points & priorities
  - Reporting helper properties vs end-user properties (flagged quick win)
  - Legacy/discontinued properties in schema
  - Pipeline complexity and reporting impact

00:55 – 01:20  Requirements deep dive
  - CRM data model goals
  - Marketing dashboard requirements
  - Dashboard and views setup

01:20 – 01:40  Quick wins alignment
  - Confirm priority order
  - Assign ownership

01:40 – 01:55  Next steps
  - Blueprint review
  - Timeline confirmation
  - Client input items outstanding

01:55 – 02:00  Wrap up
```

The AI generates this format based on project data. Not hardcoded — fully context-driven.

---

## Implementation notes for Codex

### Files to read first
- `apps/web/app/projects/[id]/page.tsx` — find the email composer and understand the project page layout
- `apps/web/components/` — check if EmailComposer exists as a standalone component
- `apps/api/src/app.ts` — existing email draft endpoint (if any) and project loading pattern
- `apps/api/src/server.ts` — `loadProjectById` function and project data shape
- `packages/shared/src/domain.ts` — Project type definition

### New API endpoints to add in `apps/api/src/app.ts`
1. `POST /api/projects/:projectId/email/draft`
2. `POST /api/projects/:projectId/agenda/generate`

Both should use the workspace AI provider (check how the portal audit agent calls the LLM and follow the same pattern).

### Persist last generated agenda?
Yes — save the last generated agenda to the project record. Add `lastAgenda Json?` to the `Project` model and run a migration. Load and display it when the section first opens so it persists across page reloads.

```prisma
model Project {
  // existing fields...
  lastAgenda Json? // { sessionType, generatedAt, content }
}
```

Migration: `pnpm prisma migrate dev --name add-project-last-agenda`

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] Email composer stripped to: text area + voice dictation + draft button + copy button
- [ ] `POST /api/projects/:projectId/email/draft` returns AI-drafted email using project context
- [ ] Agenda builder section added to project page
- [ ] All 4 session types supported
- [ ] `POST /api/projects/:projectId/agenda/generate` pulls from all 6 context sources
- [ ] Generated agenda displays inline with copy button
- [ ] Last generated agenda persists on page reload (saved to DB)
- [ ] Prisma migration runs cleanly
- [ ] No TypeScript errors
