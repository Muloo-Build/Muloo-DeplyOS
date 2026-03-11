# Roadmap

## Build order

### Phase 1: Foundation

Build:

- auth
- project model
- client and portal linking
- projects dashboard
- project creation flow

Exit criteria:

- an internal user can create and manage a project tied to a client and HubSpot portal
- project states are explicit and persisted

### Phase 2: Discovery and standards

Build:

- structured discovery model
- discovery workspace
- discovery versioning
- standards engine rules v1
- standards application UI

Exit criteria:

- discovery can be captured or imported in a structured format
- the platform can recommend Muloo standard modules with explainable reasoning

### Phase 3: Blueprint and tasks

Build:

- blueprint generator
- deliverables model
- task generator
- dependency mapping
- execution type assignment

Exit criteria:

- discovery plus standards produces a blueprint, deliverables, and execution-ready tasks

### Phase 4: Linear integration

Build:

- Linear project sync
- Linear issue creation from tasks
- status sync back into Muloo Deploy OS
- owner, label, and milestone mapping

Exit criteria:

- generated tasks can be pushed into Linear and tracked bi-directionally

### Phase 5: Execution router

Build:

- execution classification service
- execution job model
- approval gates
- shell hooks for API and agent workers

Exit criteria:

- every task has a route and risky tasks are blocked pending approval

### Phase 6: QA and audit

Build:

- QA checklist system
- QA result tracking
- approval flow
- deployment log
- activity and audit views

Exit criteria:

- work cannot be marked complete without traceable QA and approval where required

### Phase 7: Selected automation

Build only a few high-confidence automations first:

- read HubSpot portal context
- create simple properties
- create simple pipelines or stages where safe
- log execution outcomes

Exit criteria:

- the platform proves safe, auditable, narrow automation without overcommitting to agent-heavy execution

## Near-term operating principle

Do not continue adding product features randomly on top of the current prototype.

The next implementation steps should follow this order:

1. lock the workflow
2. lock the data model
3. lock the MVP screens
4. rebuild intentionally against that model
