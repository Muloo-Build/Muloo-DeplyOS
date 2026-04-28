# Project Overview Timeline

## Purpose

This document condenses the current markdown/doc set into one dated view of how Muloo Deploy OS has evolved, what now looks like source-of-truth material, and which docs are better treated as implementation history or archive-review candidates.

Dates below are based on the latest Git commit touching each file. If a file has never been committed, the filesystem date should be treated as a local draft date instead.

## Current Read

As of 2026-04-28, Muloo Deploy OS has clearly shifted from a discovery-only orchestration idea into a broader internal delivery operating system for Muloo.

The strongest current themes across the docs are:

- adaptive project workflows rather than one rigid sequence
- support for new implementation, optimisation, follow-on work, workshops, and retainers
- stronger client portal, quote, approval, and partner-aware delivery flows
- retainers, invoicing, and ongoing support becoming first-class product concerns
- project context, audit, Prepare, and task-generation becoming central to real work

In plain language:

> the docs now describe a platform that starts with discovery when needed, but also needs to handle existing-client optimisation, scoped follow-on work, retainers, and client portal collaboration without forcing every project through the same pre-sales ritual.

## Timeline

### 2026-03-11 to 2026-03-19: Foundation rules

The earliest documents define the product skeleton and operating rules:

- [docs/discovery-schema.md](./discovery-schema.md)
- [docs/standards-matrix.md](./standards-matrix.md)
- [docs/discovery-operating-model.md](./discovery-operating-model.md)
- [docs/agent-delivery-model.md](./agent-delivery-model.md)

What this phase established:

- structured discovery as the original entry point
- standards-driven implementation planning
- execution readiness and agent-routing logic
- the idea that Deploy OS exists to turn context into executable delivery work

### 2026-03-24: Product reset and source-of-truth pack

This is the biggest architecture-definition checkpoint:

- [README.md](../README.md)
- [docs/product-scope.md](./product-scope.md)
- [docs/architecture.md](./architecture.md)
- [docs/domain-model.md](./domain-model.md)
- [docs/client-workspace-and-approval-model.md](./client-workspace-and-approval-model.md)
- [docs/mvp-wireframes.md](./mvp-wireframes.md)
- [docs/roadmap.md](./roadmap.md)

What changed here:

- the repo was reframed around a v1 orchestration model
- docs became the intended source of truth over the prototype code
- the core promise became discovery -> blueprint -> tasks -> execution
- the client/partner/portal model became more explicit

This is still the cleanest baseline for understanding original product intent.

### 2026-03-25 to 2026-03-27: Delivery sprints and handoff-heavy build phase

This period shows fast implementation planning and execution:

- [docs/platform-goal-alignment-report.md](./platform-goal-alignment-report.md)
- [docs/agent-capability-roadmap.md](./agent-capability-roadmap.md)
- [docs/partner-platform-and-breeze-spec.md](./partner-platform-and-breeze-spec.md)
- [docs/sprint-portal-ops-execution-layer.md](./sprint-portal-ops-execution-layer.md)
- [docs/sprint-01-job-worker.md](./sprint-01-job-worker.md)
- [docs/sprint-02-dashboard-agent-completion.md](./sprint-02-dashboard-agent-completion.md)
- [docs/sprint-03-cowork-perplexity-integration.md](./sprint-03-cowork-perplexity-integration.md)
- [docs/sprint-04-task-board-approval-gates.md](./sprint-04-task-board-approval-gates.md)
- [docs/sprint-05-security-data-model.md](./sprint-05-security-data-model.md)
- [docs/sprint-06-email-composer-agenda-tool.md](./sprint-06-email-composer-agenda-tool.md)
- [docs/sprint-07-ux-redesign.md](./sprint-07-ux-redesign.md)
- [docs/codex-handoff-all-sprints.md](./codex-handoff-all-sprints.md)
- [docs/codex-full-bug-fix-handoff.md](./codex-full-bug-fix-handoff.md)
- [replit.md](../replit.md)

What this phase added:

- a large amount of execution detail
- Portal Ops and worker architecture
- dashboard, task board, security, email, and UX work
- several handoff docs meant to accelerate coding sessions

This phase is valuable historically, but it also creates the most documentation clutter.

### 2026-04-17: Retainers become a real product concern

Key doc:

- [docs/retainer-rules-v1.md](./retainer-rules-v1.md)

What changed:

- retainers stopped being a side topic and became a formal commercial/operational model
- the platform scope widened from project execution into recurring support and time logic

### 2026-04-22: Operationalisation and real client-shape pressure

Key docs:

- [docs/local-dev.md](./local-dev.md)
- [docs/phase-b-acceptance-walkthrough.md](./phase-b-acceptance-walkthrough.md)
- [docs/reconciliation-dry-run-summary.md](./reconciliation-dry-run-summary.md)
- [docs/magnisol-deployos-implementation-plan.md](./magnisol-deployos-implementation-plan.md)
- [docs/magnisol-deployos-enhancement-plan.md](./magnisol-deployos-enhancement-plan.md)

What changed:

- the product was tested against more realistic delivery scenarios
- Magnisol exposed that discovery is often ongoing, not just pre-sales
- workstreams, hours, client inputs, and one connected project model became more important
- retainer logic moved closer to operational readiness

This is the phase where the product starts to look less like a pure discovery engine and more like a delivery workspace.

### 2026-04-28: Transnova-style retainer, portal, and invoice workflow

Key doc:

- [docs/retainer-project-portal-invoice-spec.md](./retainer-project-portal-invoice-spec.md)

What changed:

- the product was forced to support real-world optimisation and retainer work
- client portal HubSpot connection, retainer scope, quote composition, and invoice UI were treated as immediate workflow blockers
- the docs explicitly call out that discovery is not always the right gate for getting work moving

This is the clearest articulation yet of the current operating need:

> Muloo needs a system that can handle optimisation, retainer, and follow-on work without pretending every project begins with a clean discovery cycle.

## Current Document Groups

### Keep As Source Of Truth

These are the best high-level docs for understanding the current product:

- [README.md](../README.md)
- [docs/product-scope.md](./product-scope.md)
- [docs/architecture.md](./architecture.md)
- [docs/domain-model.md](./domain-model.md)
- [docs/discovery-operating-model.md](./discovery-operating-model.md)
- [docs/discovery-schema.md](./discovery-schema.md)
- [docs/client-workspace-and-approval-model.md](./client-workspace-and-approval-model.md)
- [docs/agent-delivery-model.md](./agent-delivery-model.md)
- [docs/execution-matrix.md](./execution-matrix.md)
- [docs/standards-matrix.md](./standards-matrix.md)
- [docs/roadmap.md](./roadmap.md)
- [docs/platform-goal-alignment-report.md](./platform-goal-alignment-report.md)

### Keep As Active Product Direction

These look current and practically useful for near-term work:

- [docs/magnisol-deployos-implementation-plan.md](./magnisol-deployos-implementation-plan.md)
- [docs/magnisol-deployos-enhancement-plan.md](./magnisol-deployos-enhancement-plan.md)
- [docs/retainer-rules-v1.md](./retainer-rules-v1.md)
- [docs/retainer-project-portal-invoice-spec.md](./retainer-project-portal-invoice-spec.md)
- [docs/local-dev.md](./local-dev.md)

### Keep As Operational Validation / Reference

These are not core product docs, but they are still useful reference material:

- [docs/phase-b-acceptance-walkthrough.md](./phase-b-acceptance-walkthrough.md)
- [docs/reconciliation-dry-run-summary.md](./reconciliation-dry-run-summary.md)
- [docs/mvp-wireframes.md](./mvp-wireframes.md)

### Archive-Review Candidates

These are the most likely candidates to move into a future `docs/archive/` folder if you want the top-level `docs/` directory to stay clean:

- [docs/codex-handoff-all-sprints.md](./codex-handoff-all-sprints.md)
- [docs/codex-full-bug-fix-handoff.md](./codex-full-bug-fix-handoff.md)
- [docs/sprint-portal-ops-execution-layer.md](./sprint-portal-ops-execution-layer.md)
- [docs/sprint-01-job-worker.md](./sprint-01-job-worker.md)
- [docs/sprint-02-dashboard-agent-completion.md](./sprint-02-dashboard-agent-completion.md)
- [docs/sprint-03-cowork-perplexity-integration.md](./sprint-03-cowork-perplexity-integration.md)
- [docs/sprint-04-task-board-approval-gates.md](./sprint-04-task-board-approval-gates.md)
- [docs/sprint-05-security-data-model.md](./sprint-05-security-data-model.md)
- [docs/sprint-06-email-composer-agenda-tool.md](./sprint-06-email-composer-agenda-tool.md)
- [docs/sprint-07-ux-redesign.md](./sprint-07-ux-redesign.md)
- [replit.md](../replit.md)

Why these are candidates:

- they are implementation-sprint or tool-environment specific
- several are handoff documents for a moment in time rather than standing product references
- they add real history, but they are noisy if someone is trying to orient quickly

## Recommended Cleanup Approach

Do not delete the sprint and handoff docs yet.

Instead:

1. Keep the current top-level source-of-truth set where it is.
2. Create `docs/archive/` for sprint docs, Codex handoffs, and `replit.md` if Replit is no longer a real runtime target.
3. Keep the latest operational specs for retainers, Magnisol, and Transnova-style workflows in the main `docs/` folder.
4. Treat this file as the human starting point for understanding the documentation set over time.

## Bottom Line

The docs tell a coherent story:

- March defined the original discovery-to-delivery operating model.
- Late March pushed hard into execution architecture, sprint implementation, and UI expansion.
- April exposed the need to support real delivery patterns like optimisation, retainers, follow-on work, and client portal collaboration.
- The newest direction is not to abandon discovery, but to stop forcing it as the only valid starting point.

That makes the current product direction much clearer:

> Muloo Deploy OS should remain strong at discovery-led implementation, but it now also needs to be equally strong at summary-first optimisation, retainer delivery, and scoped follow-on work.
