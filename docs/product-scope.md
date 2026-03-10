# Product Scope

## Phase 1 goals

- Establish a stable internal repository foundation for Muloo Deploy OS.
- Provide a minimal operator-facing shell and API baseline.
- Introduce a real `OnboardingProject` blueprint that represents Muloo onboarding work.
- Preserve and elevate the existing dry-run HubSpot execution slice by connecting it to projects and modules.
- Keep storage file-backed while schemas and execution patterns settle.

## Non-goals

- Full HubSpot provisioning workflows
- Live write execution across multiple modules
- Client-facing UI
- Multi-user auth and role management
- Scheduling, agent autonomy, or background workers
- Database-backed persistence

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
- Operators can list and inspect projects through the internal shell and API.
- The CLI can run the existing dry-run property slice from project/module context.
- Project data remains understandable and maintainable without speculative complexity.
- The foundation avoids fake integrations while giving the next execution work a concrete object model.
