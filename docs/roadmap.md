# Roadmap

## Foundation

- Stabilise repository structure, scripts, docs, linting, and environment conventions.
- Keep dry-run guardrails and auditable artifacts as platform defaults.

## Input modelling

- Expand `OnboardingProject` into richer module-specific planning inputs where needed.
- Add schema versioning and migration guidance for project files.
- Improve validation coverage only where operator value is clear.
- Expand template coverage gradually without turning the template layer into a large generic configuration system.
- Extend design editing only where operators need more control beyond the current lifecycle, properties, and pipelines editors.

## HubSpot integration layer

- Expand read models beyond properties.
- Keep write capabilities narrow, explicit, and auditable.
- Start with create-only contact property apply and expand only after guardrails prove reliable.
- Introduce retry and rate-limit handling patterns.

## Execution engine

- Extend module contracts to more execution areas beyond properties.
- Keep pipeline dry-run scope intentionally narrow until write-path guardrails exist.
- Keep apply paths create-only first, with updates and deletes blocked until review workflows exist.
- Add idempotent dry-run/apply planning for more modules.
- Introduce project-linked execution summaries and review queues.
- Keep step timelines readable and consistent across modules.

## QA and audit logs

- Capture structured audit events for operator and system actions.
- Surface execution summaries, warnings, readiness issues, and review items per project.

## Templates and playbooks

- Define reusable onboarding templates and delivery playbooks.
- Grow the Muloo starter template library across sales, revops, and service delivery patterns.
- Keep the standard property library curated and auditable.
- Support controlled variation across client types, regions, and implementation types.

## Internal operator UI

- Expand the project views into a stronger guided operator workflow.
- Keep project authoring simple and task-focused before introducing any complex form builder.
- Add dedicated validation, readiness, module contract, and execution history views.
- Surface last dry-run summaries and operator next actions per project.
- Grow project design editors incrementally rather than introducing a generic schema builder.
- Keep refining Home, Projects, Runs, and Guide so the operator can understand what to do next on first use.
