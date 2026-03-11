# Muloo Deploy OS

Muloo Deploy is an internal HubSpot onboarding and optimisation workspace for Muloo. It helps a solo operator take a completed discovery, turn it into a structured onboarding blueprint, review what needs to happen, dry run changes, safely execute approved actions, and track delivery history.

## Who it is for

This repository is for Muloo operators, delivery leads, and internal builders. It is not client facing.

## Current stage

The repository is in operator-workspace stage.

What is real today:

- a file-backed `OnboardingProject` model for realistic onboarding blueprints
- project read flows through the internal API and web shell
- project validation and module readiness checks
- module execution contracts for execution-capable modules
- file-backed execution job history for project/module dry runs
- live dry-run CLI slices for HubSpot properties and pipelines
- one guarded apply path for create-only contact properties through the properties module
- file-backed project authoring through the API and internal web shell
- Muloo starter templates and a standard property library for seeded project creation
- project design editors for lifecycle stages, lead statuses, property groups, properties, pipelines, and stages
- shared execution packages for config, diffing, filesystem output, HubSpot reads, and executor flow

Current product workflow:

1. Start project
2. Connect or confirm portal
3. Build blueprint
4. Review blockers and readiness
5. Dry run changes
6. Apply safe actions
7. Track history
8. Use built-in guide and standards

What is intentionally not built yet:

- broad HubSpot write execution
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

## Templates and baseline library

Muloo Deploy OS now includes file-backed starter templates in `data/templates/`.

Each template defines:

- template metadata and type
- hubs in scope
- default module plans
- lifecycle stages and lead statuses where relevant
- baseline property groups and properties through a standard property library shape
- starter pipelines where relevant
- notes and assumptions

The first templates are:

- `muloo-sales-foundation`
- `muloo-revops-foundation`
- `muloo-service-foundation`

The standard property library shape is intentionally simple:

- `objectType`
- `groupName`
- `internalName`
- `label`
- `fieldType`
- `valueType`
- `description`
- `required`
- `options`
- `sourceTag`

Projects created from templates copy these baselines into the project blueprint so operators start from a usable Muloo standard instead of a blank file.

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
- explicit apply guardrails when apply is supported
- expected result kind
- ordered execution step templates per execution mode

The `properties` and `pipelines` modules are now live dry-run contracts. The `properties` module also supports a guarded apply path with intentionally tiny scope:

- contact properties only
- create-only operations for missing properties
- explicit `--apply` and `--allow-create-only` CLI flags
- environment guard via `MULOO_EXECUTION_MODE=guarded-apply`
- hard block on updates, deletes, renames, and option mutations

Pipeline dry-run scope is intentionally narrow in v1:

- deal pipelines
- ticket pipelines when present in the project blueprint
- pipeline identity and label comparison
- stage presence comparison
- stage order comparison

It does not attempt pipeline rules, permissions, SLAs, or workflow behavior.

## Execution job records

Project/module dry runs and guarded applies now create execution job records in `data/executions/`.

Each record stores:

- project and module context
- execution type and mode
- status and timestamps
- summary metrics
- warnings and errors
- artifact and summary output references
- normalized module execution result payloads
- requested, executed, and blocked operation summaries
- step-level execution timelines
- triggered-by and environment placeholders

Legacy raw-spec execution is still supported and remains unlinked.

## API endpoints

The internal API now exposes:

- `GET /api/health`
- `GET /api/modules`
- `GET /api/settings`
- `GET /api/runs`
- `GET /api/templates`
- `GET /api/templates/:id`
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
- `POST /api/projects`
- `POST /api/projects/from-template`
- `PUT /api/projects/:id`
- `PUT /api/projects/:id/scope`
- `GET /api/projects/:id/design`
- `PUT /api/projects/:id/design/lifecycle`
- `PUT /api/projects/:id/design/properties`
- `PUT /api/projects/:id/design/pipelines`

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

## Project authoring

Operators can now:

- create a blank project
- create a project from a Muloo starter template
- edit core project metadata
- edit hubs in scope, environment, modules, and module statuses
- inspect template provenance and seeded baseline fields on the project detail page

The UI entry point is [http://localhost:3000/projects/new](http://localhost:3000/projects/new).

## Project design editing

Operators can now edit the core onboarding blueprint inside the tool.

Current v1 design editors support:

- lifecycle stages and lead statuses
- property groups and properties by object
- pipeline and stage structure

Design endpoints:

- `GET /api/projects/:id/design`
- `PUT /api/projects/:id/design/lifecycle`
- `PUT /api/projects/:id/design/properties`
- `PUT /api/projects/:id/design/pipelines`

Design pages:

- `/project/design/lifecycle?project=<id>`
- `/project/design/properties?project=<id>`
- `/project/design/pipelines?project=<id>`

These editors are intentionally practical and form-based. They preserve template provenance visibility, keep `sourceTag` markers on seeded baseline fields, and feed directly into the existing validation and readiness model after each save.

## Product navigation

Top-level navigation now uses:

- Home
- Projects
- Templates
- Runs
- Guide
- Settings

Inside a project workspace, the operator flow is:

- Overview
- Blueprint
- Review
- Run
- History
- Guide

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

Guarded apply for properties requires explicit confirmation and remains create-only:

```bash
MULOO_EXECUTION_MODE=guarded-apply corepack pnpm cli -- --project project-apex-revenue-ops --module properties --apply --allow-create-only
```

This resolves the selected module through its execution contract, runs the relevant dry-run or guarded apply flow, and persists an execution record with a step timeline on completion.

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
