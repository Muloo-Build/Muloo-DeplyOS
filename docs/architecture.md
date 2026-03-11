# Architecture

## Proposed shape

Muloo Deploy OS remains a modular TypeScript monorepo with a clear split between operator experience, internal APIs, execution services, and shared domain models.

## Layers

### Front end

The operator-facing shell lives in `apps/web` and is served by `apps/api`. It now shows:

- project lists
- project detail views
- validation and readiness state
- module readiness
- recent dry-run execution history

### Backend and API layer

`apps/api` is the internal HTTP boundary. It exposes health, configuration readiness, module metadata, project read models, validation state, readiness summaries, and execution history.

### Job and execution layer

Execution orchestration remains package-driven. Execution-capable modules now follow an explicit contract shape defined in shared types and implemented in `@muloo/executor`.

Each module contract defines:

- metadata: key, label, supported modes, result kind
- input requirements
- validation and readiness handlers
- dry-run handler
- apply placeholder
- ordered execution step templates

This keeps future modules explicit and typed without adding a heavy plugin framework.

Two live dry-run contracts now use the same pattern:

- `properties`
- `pipelines`

### Integration layer

HubSpot and future external systems stay behind service packages with typed request and response shaping, auditability, and dry-run guardrails.

## OnboardingProject as the central planning object

`OnboardingProject` is the planning blueprint for Muloo onboarding work.

It represents:

- project metadata and ownership
- client context
- HubSpot scope and environment
- CRM design inputs
- property planning by object
- module planning and dependencies
- execution context and stored validation state

Projects are stored as validated JSON files in `data/projects/`.

## Validation and readiness

Validation is intentionally practical and lightweight.

The current model derives:

- overall project validation status: `valid`, `warning`, `invalid`, `blocked`
- overall readiness: `ready`, `not_ready`
- per-module validation and readiness
- finding arrays for errors, warnings, and info notes

This gives operators enough signal to decide whether a dry run is likely to be useful without introducing a heavy policy engine.

Readiness detail is now explicit, not implied only from status labels.

Module-level validation includes:

- blockers
- missing required inputs
- non-blocking warnings
- informational notes

Project readiness summaries aggregate those signals for operator views.

## Execution job records

Dry runs launched from project/module context now create file-backed execution records in `data/executions/`.

These records capture:

- project and module linkage
- execution type and mode
- runtime status and timestamps
- summary metrics
- warnings and errors
- output references such as artifact paths and summary text
- normalized module execution results
- ordered execution steps with timestamps, summaries, warnings, errors, and optional output references

The step timeline is intended for operator readability, not as a generic workflow engine.

Current properties dry-run step sequence:

1. load-project
2. validate-project
3. resolve-module-input
4. load-existing-hubspot-state
5. diff-desired-vs-existing
6. write-artifact
7. persist-execution-record

The pipelines module uses the same step sequence and differs only in its module-specific input resolution, validation, HubSpot state reader, and diff output.

## Current flow

1. `apps/api` loads projects, validations, readiness summaries, and execution records from file-backed helpers.
2. The web shell renders those views for operators.
3. The CLI still supports raw-spec execution.
4. The CLI can resolve `--project <id> --module properties` through the properties module contract.
5. The contract drives readiness, dry-run execution, result shaping, and execution step reporting.
6. Project-linked dry runs create execution history records for later inspection through the API and web shell.

## Principles

- Modular: keep UI, API, validation, execution logic, and integrations clearly separated.
- Typed: validate project inputs, readiness state, execution records, and environment boundaries with Zod and TypeScript.
- Auditable: persist dry-run artifacts and execution records.
- Secure: never hardcode secrets and keep destructive work explicitly gated.
- Execution focused: optimise for reliable internal delivery workflows over broad product surface area.
