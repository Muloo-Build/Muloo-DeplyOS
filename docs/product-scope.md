# Product Scope

## Phase 1 goals

- Establish a stable internal repository foundation for Muloo Deploy OS.
- Provide a minimal operator-facing shell and API baseline.
- Introduce a real `OnboardingProject` blueprint that represents Muloo onboarding work.
- Add practical project validation and module readiness checks.
- Persist project-linked dry-run execution history.
- Standardise module execution around a typed execution contract and step timeline.
- Preserve and elevate the existing HubSpot execution slices by connecting properties and pipelines to projects and modules.
- Prove the first narrow guarded apply path for create-only contact properties.
- Add practical project authoring with file-backed create and update workflows.
- Seed projects from Muloo starter templates and a reusable standard property library.
- Add practical design editors for lifecycle data, property planning, and pipeline structure.

## Non-goals

- broad HubSpot write actions
- property updates or deletes
- pipeline apply/write actions
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

## Template and authoring scope

- Blank project creation
- Template-seeded project creation
- Lightweight editing of project metadata, hubs in scope, environment, and module plans
- Editing of lifecycle stages and lead statuses
- Editing of property groups and properties by object
- Editing of pipelines and ordered stages
- Read-only visibility into template provenance and seeded baseline fields

## v1 editor limitations

- lifecycle and lead-status order is explicit rather than drag-and-drop
- property editing is form-based rather than spreadsheet-based
- pipeline editing is structural only
- advanced workflow behavior such as probabilities, SLAs, routing, and permissions stays out of scope

## Success criteria

- A project JSON file can describe a realistic onboarding blueprint.
- Operators can inspect validation and readiness state per project and per module.
- Project/module dry runs create reusable execution history records with readable step timelines.
- At least one additional non-executing module can express validation and readiness through the same contract pattern.
- At least two live modules can run through the same execution contract pattern without bespoke orchestration.
- The first apply-capable path stays narrow, explicit, and auditable.
- Operators can create and update project blueprints without editing JSON by hand.
- Template-seeded projects start with usable Muloo baselines instead of empty property and pipeline plans.
- Template-seeded projects can now be meaningfully evolved inside the tool after creation.
- The current dry-run execution slice remains intact and usable.
- The foundation stays file-backed, typed, and easy to reason about.
