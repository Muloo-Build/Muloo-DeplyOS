# Architecture

## Proposed shape

Muloo Deploy remains a modular TypeScript monorepo with a clear split between operator experience, internal APIs, execution services, and shared domain models.

## Layers

### Front end

The operator-facing shell lives in `apps/web` and is served by `apps/api`. It now shows:

- home workspace
- project queue
- template library
- run history
- guide shell
- project authoring
- project design editing
- guided project workspaces
- review and readiness state
- recent dry-run and safe-apply history

### Backend and API layer

`apps/api` is the internal HTTP boundary. It exposes health, configuration readiness, template read models, project read models, project authoring routes, review state, readiness summaries, and run history.

### Job and execution layer

Execution orchestration remains package-driven. Execution-capable modules now follow an explicit contract shape defined in shared types and implemented in `@muloo/executor`.

Each module contract defines:

- metadata: key, label, supported modes, result kind
- input requirements
- validation and readiness handlers
- dry-run handler
- guarded apply metadata and handler when enabled
- ordered execution step templates per execution mode

This keeps future modules explicit and typed without adding a heavy plugin framework.

Two live dry-run contracts now use the same pattern:

- `properties`
- `pipelines`

The `properties` contract now also supports the first guarded apply path. Its apply capability is intentionally narrow:

- contacts only
- create-only operations for missing properties
- explicit CLI flags required
- environment guard required
- no updates, deletes, renames, or option mutations

### Integration layer

HubSpot and future external systems stay behind service packages with typed request and response shaping, auditability, and dry-run-first guardrails.

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

The same project file now supports three operator workflows:

- create from blank or template
- update metadata and scope
- edit lifecycle, property, and pipeline design inputs

## Template model

Reusable starter templates are stored as validated JSON files in `data/templates/`.

Each template carries:

- template identity and type
- default hubs and modules
- lifecycle and lead-status defaults
- optional pipeline starters
- a standard property library
- notes and assumptions

Template creation remains file-backed and explicit. There is no database or dynamic template registry.

## Standard property library

The property library is the reusable baseline structure used by templates. It normalises standard Muloo fields into one shape that can be copied into projects during creation.

That structure captures:

- object type
- group name
- internal name
- label
- value type and field type
- description
- required flag
- options
- source tag

Projects preserve `sourceTag` values after seeding so operators can see which baseline elements came from Muloo standards.

## Validation and readiness

Validation is intentionally practical and lightweight.

The current model derives:

- overall project validation status: `valid`, `warning`, `invalid`, `blocked`
- overall readiness: `ready`, `not_ready`
- per-module validation and readiness
- finding arrays for errors, warnings, and info notes

This gives operators enough signal to decide whether a project is ready to review or ready to run without introducing a heavy policy engine.

Readiness detail is now explicit, not implied only from status labels.

Module-level validation includes:

- blockers
- missing required inputs
- non-blocking warnings
- informational notes

Project readiness summaries aggregate those signals for operator views.

Design edits write back into the same blueprint and immediately recalculate validation and readiness. That keeps the authoring, design, and execution surfaces aligned on one source of truth.

## Execution job records

Dry runs and guarded apply runs launched from project/module context now create file-backed execution records in `data/executions/`.

These records capture:

- project and module linkage
- execution type and mode
- runtime status and timestamps
- summary metrics
- warnings and errors
- output references such as artifact paths and summary text
- requested, executed, and blocked operations
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

The properties guarded apply sequence extends the same pattern:

1. load-project
2. validate-project
3. resolve-module-input
4. load-existing-hubspot-state
5. diff-desired-vs-existing
6. evaluate-apply-guardrails
7. execute-safe-creates
8. write-artifact
9. persist-execution-record

## Current flow

1. `apps/api` loads projects, validations, readiness summaries, and execution records from file-backed helpers.
2. The same file-backed layer loads starter templates and handles project creation and updates.
3. The same file-backed layer handles design updates for lifecycle data, property planning, and pipelines.
4. The web shell renders an operator-first Home, Projects, Templates, Runs, Guide, and guided project workspace.
5. The CLI still supports raw-spec execution.
6. The CLI can resolve `--project <id> --module ...` through module contracts.
7. Contracts drive readiness, dry-run execution, guarded apply behavior, result shaping, and execution step reporting.
8. Project-linked executions create history records for later inspection through the API and web shell.

## Principles

- Modular: keep UI, API, validation, execution logic, and integrations clearly separated.
- Typed: validate project inputs, readiness state, execution records, and environment boundaries with Zod and TypeScript.
- Auditable: persist dry-run artifacts and execution records.
- Secure: never hardcode secrets and keep any write path explicitly gated and auditable.
- Execution focused: optimise for reliable internal delivery workflows over broad product surface area.
