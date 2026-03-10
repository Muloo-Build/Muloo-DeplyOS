# Architecture

## Proposed shape

Muloo Deploy OS remains a modular TypeScript monorepo with a clear split between operator experience, internal APIs, execution services, and shared domain models.

## Layers

### Front end

The operator-facing shell lives in `apps/web` and is served by `apps/api`. It now exposes project list and project detail views alongside dashboard, modules, and settings pages.

### Backend and API layer

`apps/api` is the internal HTTP boundary. It exposes health, configuration readiness, module metadata, and now project read models from file-backed onboarding project inputs.

### Job and execution layer

Execution orchestration remains package-driven. The existing dry-run property comparison flow is preserved and can now be entered from a project/module context instead of only a raw spec path.

### Integration layer

HubSpot and future external systems stay behind service packages with typed request and response shaping, auditability, and dry-run guardrails.

## OnboardingProject as the central planning object

The first real application object is `OnboardingProject`.

It represents a Muloo onboarding blueprint with:

- project metadata and owner
- client context
- HubSpot scope and environment
- CRM design inputs
- property planning by object
- module planning and dependencies
- execution context and validation state

For now, projects are stored as validated JSON files in `data/projects/`. This keeps the system easy to inspect while product shape is still settling.

## Current flow

1. `apps/api` loads projects from `data/projects/` through file-backed helpers.
2. Project summaries and module views are exposed through `/api/projects` endpoints.
3. The web shell renders those views for operators.
4. The CLI can still execute from a raw spec path.
5. The CLI can also resolve `--project <id> --module properties` into the existing dry-run property slice.

## Principles

- Modular: keep UI, API, execution logic, and integrations clearly separated.
- Typed: validate project inputs and environment boundaries with Zod and TypeScript.
- Auditable: preserve dry-run artifacts and structured logs.
- Secure: never hardcode secrets and keep destructive work explicitly gated.
- Execution focused: optimise for reliable internal delivery workflows over broad product surface area.

## Near-term direction

1. Expand project input modelling carefully before adding writes.
2. Introduce richer module-specific input resolvers.
3. Add persistence only once project and execution lifecycles are clearer.
4. Keep dry-run as the default for any action that could affect HubSpot.
