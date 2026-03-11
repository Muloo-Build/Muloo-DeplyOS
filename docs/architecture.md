# Architecture

## Target architecture

Muloo Deploy OS should be built as an internal orchestration platform, not as a thin wrapper around isolated HubSpot execution scripts.

The system has one central flow:

1. Create project.
2. Link client and HubSpot portal.
3. Capture or import discovery.
4. Apply Muloo standards.
5. Generate blueprint.
6. Generate deliverables and tasks.
7. Classify execution type.
8. Sync to Linear.
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
- standards recommendation and application
- blueprint generation
- task generation and dependency mapping
- execution-type classification
- approval and QA flow enforcement
- audit logging
- Linear sync orchestration

### Data layer

Recommended v1 persistence:

- Postgres or Supabase Postgres

Key requirements:

- strong relational modeling
- versioned discovery submissions
- durable task and execution logs
- traceability from project to blueprint to task to execution job

### Integration layer

Integrations should sit behind typed service boundaries.

Initial integrations:

- HubSpot API for portal context reads and safe configuration actions
- Linear API for project and issue sync
- future browser-agent or Symphony-style worker for UI-only execution gaps

## Core objects

The target system centers on these objects:

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
