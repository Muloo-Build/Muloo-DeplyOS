# PROJECT_MEMORY

## Agent rule

Before making architectural changes, read this file first. Update it when major project decisions, folder structures, conventions, integrations, or implementation priorities change.

## 1. Project identity

Muloo Deploy OS is Muloo's internal delivery operating system for HubSpot-related client work.

It started as a discovery-to-blueprint orchestration tool and has evolved into a broader platform for implementation, optimisation, follow-on work, retainer support, quoting, client portal collaboration, and delivery execution.

## 2. Core purpose

The platform should help Muloo:

- understand a client or project fast
- capture context, notes, and structured inputs
- assess portal and delivery reality
- shape work into summary, scope, quote, and plan
- collaborate with clients through the portal
- manage execution, approvals, and recurring support work

Important current rule:

> not every project should be forced through full discovery before work can move forward

## 3. Architecture overview

High level:

- `apps/web`: Next.js internal workspace and client-facing portal UI
- `apps/api`: Hono/Node API, Prisma models, workflow logic, quote/task/project handlers
- PostgreSQL via Prisma for operational data
- AI workflows routed through backend workflow functions
- project flow now supports both discovery-led and summary-first/scoped work

Primary workflow shapes:

- discovery-led implementation
- audit and optimisation
- follow-on/scoped change
- workshop / sprint prep
- retainer / ongoing support

## 4. Known folders and packages

- `apps/web/`: UI components, project workspaces, client portal surfaces
- `apps/api/`: API routes, domain logic, Prisma schema, workflow generation
- `docs/`: product docs, roadmap, architecture, review/timeline docs
- `docs/project-overview-review.md`: best current narrative for where the product is
- `docs/project-overview-timeline.md`: dated evolution of the product/docs
- `docs/project-overview-miro.csv`: board-friendly timeline export
- `README.md`: source-of-truth starting point
- `.claude/`: local agent/worktree data, not part of the product

## 5. Current assumptions

- This repo is actively evolving and docs may be ahead of parts of the code.
- Existing-client work is a first-class use case, not an exception.
- Prepare/project context notes are important source material for summary generation.
- Quotes may need to be produced from meeting notes and scoped context before a full blueprint exists.
- Retainers, client portal collaboration, and HubSpot connection flows are now part of the core product direction.

## 6. Decisions made

- Discovery is still supported, but it is no longer the only valid front door.
- Optimisation and similar summary-first projects can move from context -> AI summary -> quote without a mandatory blueprint gate.
- Prepare notes/project context now feed scoped summary generation.
- Retainer and invoice behavior are part of the product direction, not side utilities.
- Internal quote editing now supports explicit quote-content overrides and manual line items, rather than only projecting discovery/summary text read-only.
- Quote drafts can now carry retainer-style manual options with hours/rate metadata, and client approval can follow the selected commercial option rather than blindly approving every alternative.
- Sprint docs and Codex handoff docs are useful history, but should not be treated as the main source of truth.

## 7. Open questions

- Which docs should be moved into `docs/archive/` versus kept active?
- How strongly should blueprinting remain in optimisation and retainer flows?
- What is the cleanest long-term UI language for summary-first work vs discovery-led work?
- Which surfaces should be the default front door for each engagement mode?
- How much of retainer/invoice/client portal flow is already shipped vs still partly in transition?

## 8. Active tasks

- Reduce discovery-first friction in optimisation and scoped workflows
- Keep project context, Prepare, quote, and client portal review aligned
- Clarify documentation layers: source-of-truth vs active direction vs archive
- Continue tightening retainer/project/portal/invoice flow
- Improve product coherence across project overview, prepare, quote, delivery, and client portal

## 9. Agent instructions

- Read `README.md` first, then `docs/project-overview-review.md` if you need fast orientation.
- Prefer current product direction over old discovery-only assumptions.
- Treat Prepare notes, project context, and real operator workflow as important inputs.
- Do not assume discovery sessions are mandatory for every engagement.
- When editing workflow logic, check both internal UI and client portal behavior.
- When editing quote behavior, preserve the distinction between source discovery data and operator-owned commercial overrides.
- Be careful with documentation sprawl; add new docs only when they improve orientation or execution.
- Ignore `.claude/` unless the user explicitly asks about it.

## 10. Things not to change without asking

- Core product positioning in `README.md` and main docs
- Retainer/commercial logic that could affect real quotes or invoices
- Client portal approval behavior
- Quote gating rules in ways that could broaden scope unexpectedly
- Data model changes that affect retainers, invoices, project access, or portal linkage
- Deleting or moving docs in bulk without explicit approval
