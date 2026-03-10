# Roadmap

## Foundation

- Stabilise repository structure, scripts, docs, linting, and environment conventions.
- Keep dry-run guardrails and auditable artifacts as platform defaults.

## Input modelling

- Expand `OnboardingProject` into module-specific planning inputs where needed.
- Add versioned schemas and migration guidance for project files.
- Introduce richer validation and review tooling for project readiness.

## HubSpot integration layer

- Expand read models beyond properties.
- Add safe, explicit write capabilities with dry-run and review modes.
- Introduce retry and rate-limit handling patterns.

## Execution engine

- Model deterministic jobs, steps, and project-linked execution history.
- Add idempotency, module execution context, and resumable dry-run/apply flows.

## QA and audit logs

- Capture structured audit events for operator and system actions.
- Surface execution summaries, warnings, and review items per project.

## Templates and playbooks

- Define reusable onboarding templates and delivery playbooks.
- Support controlled variation across client types, regions, and implementation types.

## Internal operator UI

- Expand the project views into guided execution workflows.
- Add review screens for project readiness, module dependencies, and execution outputs.
