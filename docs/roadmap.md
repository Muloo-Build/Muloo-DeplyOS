# Roadmap

## Foundation

- Stabilise repository structure, scripts, docs, linting, and environment conventions.
- Keep dry-run guardrails and auditable artifacts as platform defaults.

## Input modelling

- Expand `OnboardingProject` into richer module-specific planning inputs where needed.
- Add schema versioning and migration guidance for project files.
- Improve validation coverage only where operator value is clear.

## HubSpot integration layer

- Expand read models beyond properties.
- Add safe, explicit write capabilities with dry-run and review modes.
- Introduce retry and rate-limit handling patterns.

## Execution engine

- Extend module contracts to more execution areas beyond properties.
- Keep pipeline dry-run scope intentionally narrow until write-path guardrails exist.
- Add idempotent dry-run/apply planning for more modules.
- Introduce project-linked execution summaries and review queues.
- Keep step timelines readable and consistent across modules.

## QA and audit logs

- Capture structured audit events for operator and system actions.
- Surface execution summaries, warnings, readiness issues, and review items per project.

## Templates and playbooks

- Define reusable onboarding templates and delivery playbooks.
- Support controlled variation across client types, regions, and implementation types.

## Internal operator UI

- Expand the project views into guided execution workflows.
- Add dedicated validation, readiness, module contract, and execution history views.
- Surface last dry-run summaries and operator next actions per project.
