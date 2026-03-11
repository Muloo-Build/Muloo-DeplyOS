# Product Scope

## Phase 1 goals

- Establish a stable internal repository foundation for Muloo Deploy OS.
- Provide a minimal operator-facing shell and API baseline.
- Introduce a real `OnboardingProject` blueprint that represents Muloo onboarding work.
- Add practical project validation and module readiness checks.
- Persist project-linked dry-run execution history.
- Standardise module execution around a typed execution contract and step timeline.
- Preserve and elevate the existing dry-run HubSpot execution slices by connecting properties and pipelines to projects and modules.

## Non-goals

- HubSpot write actions
- Deep multi-step workflow automation
- Client-facing UI
- Multi-user auth and role management
- Scheduling or background worker infrastructure
- Database-backed persistence
- Dynamic plugin systems or workflow engines

## Key modules

- CRM Setup
- Pipelines
- Properties
- Automation
- Reporting
- QA
- Audit and handover support

## Success criteria

- A project JSON file can describe a realistic onboarding blueprint.
- Operators can inspect validation and readiness state per project and per module.
- Project/module dry runs create reusable execution history records with readable step timelines.
- At least one additional non-executing module can express validation and readiness through the same contract pattern.
- At least two live modules can run through the same execution contract pattern without bespoke orchestration.
- The current dry-run execution slice remains intact and usable.
- The foundation stays file-backed, typed, and easy to reason about.
