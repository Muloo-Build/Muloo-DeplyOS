# Discovery Operating Model

## Purpose

Muloo discovery is not a generic requirements workshop.

It is a structured commercial and operational diagnosis that must:

- determine whether HubSpot is the right fit
- classify the engagement type
- capture the current state and future state
- identify adoption and change-management risk
- define the initial delivery scope
- surface likely scope-change pressure before onboarding starts

In plain English:

> discovery must decide what should be sold, what should be built, and what could go wrong.

## Primary discovery outcomes

Every completed discovery must produce these outputs:

1. a recommended engagement track
2. a platform-fit recommendation
3. a structured summary of the client's current state
4. a structured definition of the future state
5. a first-pass implementation scope
6. a risk and blocker register
7. a change-management and adoption rating
8. a blueprint-ready project record inside Deploy OS

## Engagement tracks

Deploy OS should classify each project into one primary track.

### 1. New CRM / Greenfield

Use when:

- the client has no CRM
- the client has no suitable CRM process in place
- the client is still deciding whether HubSpot is the right platform

Discovery focus:

- business model and growth goals
- current database and tooling
- sales and marketing process maturity
- data ownership and process design
- platform-fit assessment

Primary risk themes:

- poor platform fit
- unclear process ownership
- low readiness for change
- unrealistic timeline expectations

### 2. HubSpot onboarding / new build

Use when:

- the client has already bought HubSpot
- the client has committed to HubSpot and now needs onboarding
- the work is primarily about setting up the first operating model in HubSpot

Discovery focus:

- user readiness and adoption
- object model and process design
- lifecycle, pipeline, automation, reporting
- rollout and enablement planning

Primary risk themes:

- low HubSpot understanding
- weak adoption planning
- undefined ownership after go-live
- under-scoped onboarding effort

### 3. HubSpot optimisation / revamp

Use when:

- the client already uses HubSpot
- the client has low adoption, poor data quality, or weak process alignment
- the work is mainly about improving an existing stack

Discovery focus:

- audit of current configuration
- reporting and automation gaps
- process bottlenecks
- hygiene, governance, and ownership

Primary risk themes:

- hidden technical debt
- duplicate or unreliable data
- change resistance from existing users
- unclear business priorities

### 4. Migration to HubSpot

Use when:

- the client is on another CRM and moving to HubSpot
- migration complexity is a major part of the project

Discovery focus:

- source-system structure
- data quality and migration risk
- object mapping and historical data decisions
- process redesign versus process lift-and-shift
- adoption and training implications

Primary risk themes:

- underestimating migration effort
- weak source data quality
- process mismatch between old CRM and HubSpot
- training and change-management failure

## Platform-fit rule

Deploy OS must not assume HubSpot is always correct.

Every discovery should end with one of these platform-fit outcomes:

- `fit-confirmed`
- `fit-possible-with-caveats`
- `fit-not-recommended`

If HubSpot is not recommended, discovery should still produce value:

- summary of current state
- recommended next steps
- reasons for non-fit
- optional alternative tooling direction

## Four-session discovery model

Muloo discovery should run as four fixed-fee sessions with one clear purpose each.

### Session 1: Business and commercial context

Goal:

- understand the business, why this project exists, and what success means

Capture:

- company overview
- business model
- service lines
- current commercial priorities
- why now
- goals and success metrics
- stakeholders and decision makers
- timeline expectations
- budget and commercial constraints

### Session 2: Current state and systems

Goal:

- understand how the business works today and what is broken

Capture:

- current CRM or database setup
- existing tools and tech stack
- source systems and data locations
- current workflows
- reporting maturity
- data quality and ownership
- prior CRM history
- current pain points

### Session 3: Future state design

Goal:

- define the target operating model inside HubSpot or the chosen platform

Capture:

- hubs and features required
- objects in scope
- pipeline design
- lifecycle and qualification logic
- automation requirements
- integration requirements
- reporting requirements
- website / CMS implications
- service and support implications

### Session 4: Scope, delivery, and readiness

Goal:

- define boundaries, risks, ownership, and readiness to move into delivery

Capture:

- confirmed scope
- out of scope
- priority order
- delivery assumptions
- risks and blockers
- client responsibilities
- internal owner on client side
- adoption risk
- change-management requirement
- agreed next steps

## Mandatory cross-cutting assessments

These assessments must be made in every discovery, regardless of track.

### Change-management assessment

Rate:

- `low`
- `medium`
- `high`

Signals:

- user resistance
- low stakeholder alignment
- limited internal ownership
- large process change
- weak training readiness

### Data-readiness assessment

Rate:

- `low`
- `medium`
- `high`

Signals:

- scattered spreadsheets
- duplicate systems
- poor hygiene
- missing ownership
- unknown migration quality

### Scope-volatility assessment

Rate:

- `low`
- `medium`
- `high`

Signals:

- active rebrand
- changing leadership direction
- undefined service-line priorities
- unclear ownership
- likely future work outside initial contract

## Discovery deliverables

The discovery phase should produce three internal outputs and one commercial output.

### Internal outputs

1. structured discovery record in Deploy OS
2. blueprint-ready project definition
3. internal risk and readiness summary

### Commercial output

4. client-facing discovery recommendation document

That client-facing document should include:

- business context summary
- current-state diagnosis
- recommended future-state direction
- phased priorities
- recommended tooling or HubSpot scope
- key risks and dependencies
- next steps

## Discovery Structuring Agent

This should be the first productised agent inside Deploy OS.

### Job

Turn messy discovery inputs into a structured, reviewable project record.

### Inputs

- Gemini or meeting-summary text
- raw call notes
- uploaded documents
- Miro summary inputs
- operator notes
- existing project metadata

### Outputs

- recommended engagement track
- recommended platform-fit outcome
- pre-filled session fields for all four sessions
- assumptions list
- open questions list
- risks and blockers
- change-management rating
- data-readiness rating
- scope-volatility rating
- recommended next questions

### Rules

- never silently overwrite operator-entered answers
- mark inferred content as inferred
- separate confirmed facts from assumptions
- highlight contradictions and missing information
- ask for human confirmation before finalising the structured record

### Success condition

The operator should spend less time rewriting notes and more time validating the discovery story.

## Delivery Planner Agent

This should be the second productised agent inside Deploy OS.

### Job

Convert approved discovery into a delivery-ready blueprint and planning view.

### Inputs

- approved discovery record
- engagement track
- platform-fit outcome
- Muloo standards
- pricing rules
- risk profile

### Outputs

- phased blueprint
- human / agent / client task split
- effort estimate
- first-pass pricing guidance
- dependencies and blockers
- handover summary for delivery

### Rules

- blueprint must be explainable
- risky recommendations must be flagged, not buried
- output should separate fixed-scope work from likely future projects

## Minimum planner model

Deploy OS does not need to replace a full PMO tool immediately.

It does need a lightweight planning layer after discovery.

Each task should support:

- title
- phase
- status
- task type: `Human`, `Agent`, `Client`
- owner
- due date
- dependency list
- notes
- approval required
- QA required
- source: `discovery`, `blueprint`, `change-request`

This is enough to:

- hand work to the delivery team
- hand bounded tasks to agents
- keep the board operationally useful

## Miro and Deploy OS split

Miro should remain the collaborative workshop canvas.

Use Miro for:

- live process mapping
- collaborative whiteboarding
- collecting supporting docs
- shared working boards with clients

Use Deploy OS for:

- structured discovery record
- engagement classification
- risks and readiness
- blueprint generation
- delivery planning
- agent orchestration
- change-request control

## Scope-change principle

Discovery does not end scope change.

It should make scope change visible earlier.

Deploy OS should explicitly capture:

- what was sold
- what was assumed
- what was deferred
- what is out of scope
- what future phases are likely

This is the foundation for the later change-request engine.

## Build priority

Near-term build order for this model:

1. align the current discovery workspace to the four-session operating model
2. add engagement-track and platform-fit classification
3. add change-management, data-readiness, and scope-volatility ratings
4. build the Discovery Structuring Agent
5. harden blueprint generation against the new discovery outputs
6. add the lightweight planner for post-discovery handoff
7. build the change-request engine later on top of the same structure
