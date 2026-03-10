# Muloo Deploy OS

Muloo Deploy OS is an internal execution platform for Muloo. It standardises and automates the delivery work that happens after discovery is complete, starting with HubSpot onboarding and expanding into broader execution support for CRM design, module planning, QA, and handover operations.

## Who it is for

This repository is for Muloo operators, delivery leads, and internal builders. It is not client facing.

## Current stage

The repository is in foundation-plus-input-modelling stage.

What is real today:

- a file-backed `OnboardingProject` model that represents real onboarding blueprints
- project read flows through the internal API and web shell
- a dry-run CLI slice for HubSpot contact property comparison
- shared execution packages for config, diffing, filesystem output, HubSpot reads, and executor flow
- initial shared domain models for clients, portals, projects, jobs, steps, modules, and audit logs

What is intentionally not built yet:

- live HubSpot write execution beyond the existing dry-run comparison slice
- persistent storage beyond file-backed project data
- operator authentication and permissions
- agent orchestration or scheduling

## Onboarding projects

An `OnboardingProject` is the first real planning object in the system. It captures:

- project metadata and ownership
- client context
- HubSpot scope and environment
- CRM design inputs such as lifecycle stages, pipelines, and objects in scope
- property planning by object
- module planning and dependencies
- execution context such as dry-run enablement and validation state

Sample projects live in `data/projects/` and are validated on load.

## API endpoints

The internal API now exposes:

- `GET /api/health`
- `GET /api/modules`
- `GET /api/settings`
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/projects/:id/modules`
- `GET /api/projects/:id/summary`

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

Project/module mode now works as well:

```bash
corepack pnpm cli -- --project project-apex-revenue-ops --module properties
```

This currently resolves the contact property planning from the selected project into the existing dry-run property comparison flow.

## Repo structure

- `apps/api`: internal Node API, project endpoints, health endpoint, and static web shell hosting
- `apps/web`: dashboard shell assets and minimal operator pages
- `apps/cli`: dry-run execution slice with both raw spec and project/module entrypoints
- `packages/shared`: shared domain schemas and module catalogue
- `packages/config`: environment loading and validation
- `packages/core`, `packages/hubspot-client`, `packages/diff-engine`, `packages/executor`, `packages/file-system`: preserved execution-layer packages plus new file-backed project read helpers
- `data/projects`: sample onboarding project blueprints
- `docs`: architecture, scope, and roadmap
- `specs`: legacy sample execution specs
- `artifacts`: machine-readable outputs from dry runs and future executions
- `.github`: collaboration and CI scaffolding
