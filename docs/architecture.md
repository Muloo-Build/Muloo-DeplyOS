# Architecture

## Target architecture

Muloo Deploy OS should be built as an internal orchestration platform, not as a thin wrapper around isolated HubSpot execution scripts.

The system has one central flow:

1. Create project.
2. Link the operational client and HubSpot portal.
3. Capture or import discovery.
4. Apply Muloo standards.
5. Generate blueprint.
6. Generate deliverables and tasks.
7. Classify execution type.
8. Publish to the internal project board.
9. Track execution, QA, approvals, and deployment state.

## Core layers

### Front end

Recommended stack:

- Next.js internal app
- simple admin-style UI
- workflow-first screens, not marketing polish

The front end should primarily support:

- project creation and dashboard views
- discovery intake and review
- standards application review
- blueprint review
- task generation and approval
- execution planning
- QA and deployment review
- audit and activity history

### Application layer

The backend should own orchestration logic rather than pushing product logic into the UI.

Primary responsibilities:

- project lifecycle state management
- partner, client group, client, and portal relationship management
- standards recommendation and application
- blueprint generation
- task generation and dependency mapping
- execution-type classification
- approval and QA flow enforcement
- audit logging
- internal board orchestration and status management

### Data layer

Recommended v1 persistence:

- Postgres or Supabase Postgres

Key requirements:

- strong relational modeling
- support for partner visibility across selected downstream clients
- support for client groups that contain multiple operational clients with separate portals
- versioned discovery submissions
- durable task and execution logs
- traceability from project to blueprint to task to execution job

### Integration layer

Integrations should sit behind typed service boundaries.

Initial integrations:

- HubSpot API for portal context reads and safe configuration actions
- future browser-agent or Symphony-style worker for UI-only execution gaps

## Core objects

The target system centers on these objects:

- Partner
- Client Group
- Client
- HubSpot Portal
- Project
- Discovery Submission
- Standard Module
- Blueprint
- Deliverable
- Task
- Execution Job
- QA Check
- Deployment Log

The relationship model is defined in [Domain Model](./domain-model.md).

## Account and access model

Deploy OS should distinguish between:

- the `partner` Muloo may be delivering through
- the operational `client` the work is actually for
- the `client group` that may contain multiple client entities
- the specific `HubSpot portal` targeted by the project

Important rule:

- a `Project` should target one operational client and one HubSpot portal
- partner visibility should be granted through explicit relationship/access rules, not by pretending the partner is the client
- separate HubSpot portals should normally be modeled as separate operational clients even when they roll up to one parent group

## Execution model

Every task must have one execution type:

- `api`
- `agent`
- `manual`

Routing rule:

- API first
- agent second
- manual where needed

Execution jobs should only exist after task generation and should always record:

- input payload
- method used
- status
- output log
- error log
- timestamps

## AI role in v1

AI is a support layer, not the system of record.

Use AI for:

- interpreting discovery
- generating blueprint suggestions
- generating task drafts
- classifying execution types
- summarising risks and dependencies

Do not use AI in v1 as the sole authority for execution without human approval.

## Current prototype guidance

The existing file-backed prototype can still contribute:

- layout and shell components worth keeping
- HubSpot execution utilities worth extracting
- early project/template data patterns worth reviewing

It should not be treated as the final domain or workflow model for v1.
