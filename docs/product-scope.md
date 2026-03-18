# Product Scope

## One-line positioning

Muloo Deploy OS is Muloo's internal delivery orchestration system that turns HubSpot discovery into structured, standardised, and executable implementation work.

## What it is

Muloo Deploy OS is an internal operations layer for Muloo's delivery team.

Its purpose is to:

- capture structured discovery and onboarding context
- apply Muloo standards and reusable implementation logic
- generate a recommended implementation blueprint
- convert that blueprint into executable work
- sync the work into Linear and track delivery state

In plain English:

> Muloo Deploy OS turns discovery into delivery.

## Who it is for

Primary users:

- Jarrud
- internal Muloo delivery team members

Secondary users later:

- consultants
- implementation partners
- QA reviewers
- delivery leads

Not a v1 user:

- clients

## What v1 includes

Version 1 must do these six things well:

1. Create a project tied to a client and HubSpot portal.
2. Capture or import structured discovery inputs.
3. Apply Muloo standard setup modules based on hubs, tiers, and use cases.
4. Generate a blueprint of deliverables and recommended architecture.
5. Turn the blueprint into clear tasks with dependencies and execution type.
6. Sync those tasks into Linear and track execution status.

Supporting v1 capabilities:

- project setup and project states
- structured discovery versioning
- reusable Muloo standards library
- blueprint generation with risks and dependencies
- task generation with QA and approval flags
- execution routing across API, agent, and manual work
- QA, approval, deployment logging, and audit trail

## What v1 excludes

To keep scope sane, v1 does not try to do the following:

- full end-to-end HubSpot execution for every task
- deep custom UI automation from day one
- complex multi-tenant client access
- advanced reporting on day one
- replacing Linear
- replacing HubSpot
- replacing human approval
- becoming a full PSA, ERP, CRM, and PM tool in one

## Product promise

After discovery is complete, the product should answer five questions clearly:

1. What needs to be built?
2. What does Muloo recommend as the standard architecture?
3. What tasks need to happen, and in what order?
4. Which tasks can be executed by API, by agent, or manually?
5. What is done, what is pending, and what still needs approval?

If the system answers those five questions reliably, v1 is doing its job.

## Product rules

1. Discovery drives everything.
2. Muloo standards are reusable IP, not hardcoded chaos.
3. Blueprint comes before execution.
4. Every task needs an execution type.
5. Every risky task needs approval.
6. Every execution needs a log.
7. API first, agent second, manual when needed.
8. The platform stays useful even if automation fails.

## Immediate deliverables

Before more product code is built, these artifacts are the required baseline:

- [Domain Model](./domain-model.md)
- [Discovery Operating Model](./discovery-operating-model.md)
- [Client Workspace And Approval Model](./client-workspace-and-approval-model.md)
- [Discovery Schema](./discovery-schema.md)
- [Standards Matrix](./standards-matrix.md)
- [Execution Matrix](./execution-matrix.md)
- [MVP Wireframes](./mvp-wireframes.md)
