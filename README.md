# Muloo Deploy OS

Muloo Deploy OS is an internal execution platform for Muloo. It standardises and automates the delivery work that happens after discovery is complete, starting with HubSpot onboarding and expanding into broader execution support for CRM design, module planning, QA, and handover operations.

## Who it is for

This repository is for Muloo operators, delivery leads, and internal builders. It is not client facing.

## Current stage

The repository is in foundation-plus-operations-readiness stage.

What is real today:

- a file-backed `OnboardingProject` model for realistic onboarding blueprints
- project read flows through the internal API and web shell
- project validation and module readiness checks
- module execution contracts for execution-capable modules
- file-backed execution job history for project/module dry runs
- live dry-run CLI slices for HubSpot properties and pipelines
- shared execution packages for config, diffing, filesystem output, HubSpot reads, and executor flow

What is intentionally not built yet:

- HubSpot write execution
- persistent storage beyond file-backed JSON
- operator authentication and permissions
- heavy workflow orchestration or background job runners

## Onboarding projects

An `OnboardingProject` is the core planning object in the system. It captures:

- project metadata and owner
- client context
- HubSpot scope and environment
- CRM design inputs such as lifecycle stages, pipelines, and objects in scope
- property planning by object
- module planning and dependencies
- execution context and validation state

Sample projects live in `data/projects/` and are validated on load.

## Validation and readiness

Validation is a lightweight operational check, not a compliance engine.

The platform now derives:

- overall project validation status
- project readiness outcome
- per-module validation status
- per-module readiness outcome
- errors, warnings, and informational notes

This lets operators see whether a project can be run safely and which modules are still blocked or incomplete.

## Module execution contracts

Execution-capable modules now follow a shared contract shape.

Each contract defines:

- module key and label
- supported execution modes
- declared input requirements
- validation and readiness handlers
- dry-run handler and apply placeholder
- expected result kind
- ordered execution step templates

The `properties` and `pipelines` modules are now live dry-run contracts. Pipeline dry-run scope is intentionally narrow in v1:

- deal pipelines
- ticket pipelines when present in the project blueprint
- pipeline identity and label comparison
- stage presence comparison
- stage order comparison

It does not attempt pipeline rules, permissions, SLAs, or workflow behavior.

## Execution job records

Project/module dry runs now create execution job records in `data/executions/`.

Each record stores:

- project and module context
- execution type and mode
- status and timestamps
- summary metrics
- warnings and errors
- artifact and summary output references
- normalized module execution result payloads
- step-level execution timelines
- triggered-by and environment placeholders

Legacy raw-spec execution is still supported and remains unlinked.

## API endpoints

The internal API now exposes:

- `GET /api/health`
- `GET /api/modules`
- `GET /api/settings`
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/projects/:id/modules`
- `GET /api/projects/:id/modules/:moduleKey`
- `GET /api/projects/:id/summary`
- `GET /api/projects/:id/validation`
- `GET /api/projects/:id/readiness`
- `GET /api/projects/:id/executions`
- `GET /api/executions/:id`
- `GET /api/executions/:id/steps`
- `GET /api/projects/validation-summary`

## Run locally

1. Install dependencies.

```bash
corepack pnpm install
```

2. Copy `.env.example` to `.env` and fill only the values you need.

3. Build the workspace.

```bash
corepack pnpm build
```

4. Start the internal API and web shell.

```bash
corepack pnpm start
```

5. Open [http://localhost:3000](http://localhost:3000).

## CLI usage

Legacy raw-spec mode remains available:

```bash
corepack pnpm cli -- --spec specs/examples/contact-properties.json
```

Project/module mode now creates execution history:

```bash
corepack pnpm cli -- --project project-apex-revenue-ops --module properties
```

```bash
corepack pnpm cli -- --project project-apex-revenue-ops --module pipelines
```

This resolves the selected module through its execution contract, runs the relevant dry-run flow, and persists an execution record with a step timeline on completion.

## Repo structure

- `apps/api`: internal Node API, project endpoints, validation/readiness endpoints, and static web shell hosting
- `apps/web`: dashboard shell assets and minimal operator pages for project, module, and execution inspection
- `apps/cli`: dry-run execution slice with both raw spec and project/module entrypoints
- `packages/shared`: shared domain schemas, readiness detail types, contract metadata, and execution record types
- `packages/config`: environment loading and validation
- `packages/core`, `packages/hubspot-client`, `packages/diff-engine`, `packages/executor`, `packages/file-system`: execution-layer packages plus module contracts, file-backed project models, validation, and execution history helpers
- `data/projects`: sample onboarding project blueprints
- `data/executions`: persisted project/module dry-run history
- `docs`: architecture, scope, and roadmap
- `specs`: legacy sample execution specs
- `artifacts`: machine-readable outputs from dry runs and future executions
- `.github`: collaboration and CI scaffolding
