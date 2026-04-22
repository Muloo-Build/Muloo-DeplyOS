# Magnisol DeployOS Enhancement Plan

## Intent

This document is not a proposal for a new app.

It is a plan for how the current `Muloo DeployOS` product should be enhanced so it can support delivery for a client like `Magnisol` based on:

- the revised Magnisol gameplan workbook
- the current Muloo DeployOS audit workbook
- the existing portal shape already in the product

The goal is to make the current portal better at handling a project that combines:

- discovery
- HubSpot implementation
- website delivery
- agent-assisted execution
- time tracking against the project
- client self-serve discovery and setup inputs
- one-click seeding of standard portal assets like custom properties and hygiene outputs

## Core correction

The current portal already has the right bones:

- project overview
- discovery workspace
- portal audit
- blueprint / quote flow
- delivery board
- client questionnaire
- retainers and hour logic
- agent runs

The issue is not that Muloo needs a different product.

The issue is that the current product needs to better support a more complete delivery model inside the same project.

## What Magnisol is telling us

From the workbook and screenshots, this kind of client delivery needs DeployOS to support one connected project where:

- discovery is ongoing and not just a pre-sales artifact
- implementation work is phased and tracked against actual effort
- website delivery sits alongside HubSpot delivery because the two affect each other
- agents help prepare and execute repeatable setup work
- clients can contribute structured inputs directly in the portal
- Muloo can seed a standard setup pack quickly instead of rebuilding the same foundations manually every time

## What the current portal does well already

The audit and codebase show real strengths already in place:

- the project overview has enough structure to become the main control surface
- the discovery workspace already supports session-based capture
- the delivery board already supports `plannedHours` and `actualHours`
- the client portal already supports questionnaire access and client submissions
- delivery workstreams already exist in the project model
- portal audit and findings already exist
- agent assignment and queued runs already exist
- retainers and hour consumption rules already exist

This is strong. The next step is to connect these capabilities more intentionally.

## Main product gap

The current product still feels like separate features living near each other.

For a client like Magnisol, the portal needs to behave more like a single operating workspace where:

1. discovery feeds implementation
2. implementation feeds website work
3. audit and hygiene findings feed the delivery board
4. delivery work feeds time tracking
5. standard Muloo setup packs can be applied with one action

## Enhancement direction

### 1. Keep one project, but make workstreams first-class

DeployOS already stores `deliveryWorkstreams`.

That should be elevated in the UI and workflow so a project can clearly show:

- `Discovery`
- `Implementation`
- `Website`

This does not mean three separate apps or even three separate projects.

It means one project in the existing portal with three linked workstreams that each have:

- status
- owner
- summary
- hours
- tasks
- dependencies

### 2. Make the project overview the real command centre

The current overview is close, but for Magnisol-style delivery it should become the place where you can immediately answer:

- what have we captured?
- what has the client given us?
- what did the portal audit find?
- what standard setup has already been seeded?
- how many hours have we planned and used?
- what is waiting on Muloo, client, partner, or agent?

Add or strengthen these cards on the existing overview:

- `Workstreams`
- `Hours`
- `Standard Pack Status`
- `Client Inputs`
- `Portal Audit & Hygiene`
- `Next Actions`

### 3. Extend discovery, not replace it

The current session-based discovery model is good and should stay.

What it needs is extra coverage for this delivery shape.

Add dedicated discovery sections or question groups for:

- portal optimisation goals
- website requirements
- data hygiene and quality concerns
- standard property requirements
- regional or business-unit differences
- what the client wants to self-manage in the portal

These should fit into the current `clientQuestionnaire` and discovery structures, not a separate module.

### 4. Connect client self-serve inputs to actual setup work

Today the client questionnaire is useful, but it still feels upstream from execution.

The portal should map client inputs directly into:

- discovery completeness
- audit focus areas
- proposed custom property packs
- dashboard/report recommendations
- delivery starter tasks

Example:

- if the client identifies lifecycle inconsistency, create a finding and a delivery starter
- if the client identifies regional reporting needs, seed reporting and property tasks
- if the client identifies website conversion issues, seed CMS and forms work

### 5. Add a one-click setup action inside the existing product

This is the biggest operational improvement.

The project should support a one-click action that seeds the standard Muloo setup pack into the current project.

This is not a new product. It is an enhancement to the current project setup / portal ops flow.

Suggested action names:

- `Launch Standard Pack`
- `Seed Portal Foundation`
- `Apply Muloo Setup Pack`

Recommended result of that action:

- seed default workstreams if missing
- seed standard property groups and property plan
- queue portal snapshot and hygiene outputs
- seed standard dashboards / report recommendations
- create delivery starter tasks
- assign agent-ready tasks where appropriate
- update project overview with seeded asset counts and status

### 6. Make audit findings actionable in the delivery board

The audit already produces findings and quick wins.

For this product to support real delivery, those findings must connect more tightly to the board.

Each finding should be able to produce:

- a workstream
- a recommended task
- a planned hours estimate
- a likely owner
- a readiness state
- an agent suitability hint

That would let the board become the execution surface for the audit rather than just a separate planning view.

### 7. Treat hours as core, not optional

The audit workbook was right to call out time tracking as a major gap.

For Magnisol-style delivery, hours need to show up clearly in the current project experience.

At minimum:

- project total planned hours
- project total actual hours
- hours by workstream
- hours by task owner type: human, agent, client
- variance between planned and actual
- whether the work is discovery, implementation, or website

This should use the existing task hour fields and retainer logic rather than inventing a second tracking model.

### 8. Make agent participation visible

Agents are already part of the product direction.

For this client shape, the portal should make it clearer where agents can help now.

Strong candidates:

- prepare discovery summary
- structure working doc
- review custom property requirements
- compare standard property pack against current portal
- draft hygiene findings
- prepare dashboard/report starter recommendations
- generate delivery board starters from approved scope

The portal should show:

- which tasks are agent-assisted
- which tasks are agent-runnable
- what output was generated
- what still needs human review

### 9. Keep website delivery inside the same project context

The workbook makes it clear that the website workstream is commercially distinct, but it is still operationally linked to the same delivery effort.

The current project model should support this by:

- keeping website as a workstream inside the project
- allowing separate ownership and commercial notes
- linking website tasks to the same discovery and client context
- letting the client see progress without splitting the project into disconnected spaces

This is already close because `deliveryWorkstreams` and `internalCommercials` exist. The missing piece is better UX and tighter linking to tasks and discovery.

## Specific enhancements to the current portal surfaces

### Project Overview

Enhance the current overview to show:

- workstream cards with status and hour totals
- standard pack status
- client submission status by section
- audit snapshot and hygiene summary
- agent contribution summary
- website workstream summary beside HubSpot workstream summary

### Discovery page

Extend the current discovery page with:

- portal optimisation inputs
- website requirements inputs
- data hygiene inputs
- regional / market variation inputs
- seed-to-task recommendations after save

### Portal Audit page

Expand the audit page so it can:

- classify findings by workstream
- suggest standard packs to apply
- create delivery tasks from findings
- show hygiene score or readiness summary

### Delivery Board

Enhance the board so it can:

- roll up hours by workstream
- filter by `Discovery`, `Implementation`, `Website`
- show task origin from audit or questionnaire
- show agent suitability more clearly
- compare planned vs actual at project and workstream level

### Client Portal

Enhance the client-facing project workspace so it can:

- collect structured async inputs beyond the four default sections
- show what Muloo has already seeded
- show what is waiting on the client
- show website and implementation progress in one place
- make quote / approval / scope changes easier to understand

## Suggested data / model additions

The current model already supports much of this, so additions should stay light.

Useful additions inside the existing project shape:

- `standardPackStatus`
- `seededAssetsSummary`
- `hygieneSummary`
- `hoursByWorkstream`
- `clientInputCoverage`
- `taskOrigin` such as `audit`, `questionnaire`, `manual`, `template`

Useful additions to questionnaire config:

- `Portal Optimisation Goals`
- `Website Requirements`
- `Data Hygiene Inputs`

Useful additions to task metadata:

- `workstreamId`
- `producedBy`
- `taskOrigin`
- `billingCategory`

## Recommended build order

### Phase 1: Tighten the current UX around the existing model

- promote workstreams on the overview
- extend discovery questions
- show hours more clearly on project and board
- show audit findings with stronger routing into execution

### Phase 2: Add the one-click setup pack

- seed standard property planning
- seed audit / hygiene outputs
- seed dashboard recommendations
- seed starter tasks and agent-ready work

### Phase 3: Connect everything end to end

- map client inputs into findings and tasks
- map findings into board starters
- roll up hours by workstream
- expose seeded status and completion status on overview

### Phase 4: Commercial and delivery refinement

- better website workstream tracking
- clearer split between fixed discovery, phased implementation, and linked website effort
- stronger retainer / top-up flow for post-launch portal ops

## Bottom line

The right move is to enhance `Muloo DeployOS` in its current shape so it can better support this client delivery model.

The platform does not need a new identity.

It needs a tighter operating flow inside the product it already has:

- stronger workstream handling
- richer client self-serve inputs
- one-click standard portal seeding
- audit-to-delivery conversion
- clearer hour tracking
- more visible agent participation

If we do those things, the current portal becomes much better suited to deliver Magnisol and clients like it without breaking the existing product direction.
