# Platform Goal Alignment Report

## Why this report exists

Muloo Deploy OS is no longer just a prototype with disconnected features.

It now has the beginnings of a real operating system for Muloo's client work:

- a command centre
- client and project workspaces
- portal audit
- portal ops
- adaptive project workflow
- a prepare workspace
- runs, agents, and AI routing

That is good progress, but it creates a new risk:

> the platform can drift into a bundle of useful features without staying aligned to the real operating model Muloo needs day to day.

This report is the alignment pass.

Its job is to define:

1. the core platform promise
2. the engagement modes the product must support
3. the workspace clusters the UI should revolve around
4. the current feature map against that model
5. the main product and architecture gaps
6. the build order from here
7. whether the platform is in reach of the intended outcome

## Current status

### Are we in reach?

Yes.

The platform is now close enough to the intended shape that alignment will compound future work instead of resetting it.

Current signals that we are in reach:

- project navigation is already moving from rigid sequence to adaptive clusters
- the platform now distinguishes operational tools like Portal Ops, Audit, Runs, and Agents
- existing-client work is starting to get its own flow through `Prepare`
- portal audit and portal ops are functioning as dedicated capabilities rather than loose experiments
- AI routing exists, which gives the product a central control point for AI workflows

What is still missing is not raw feature count. It is product coherence.

The next stage is to make the platform feel like one operating model instead of several strong ideas sitting next to each other.

## 1. Core platform promise

### Recommended one-line promise

Muloo Deploy OS helps Muloo understand a client fast, assess delivery reality, prepare the next move, shape work into scope, and execute repeatable delivery actions without losing context.

### Expanded promise

The platform should make Muloo faster and sharper in five moments:

1. when a new client or new project first lands
2. when an existing client needs optimisation, change, or follow-on work
3. when Muloo needs to prepare for a workshop, onsite session, or scoping meeting
4. when findings and requests need to become scoped workstreams
5. when repeatable delivery actions need to be run safely and visibly

### What the product should answer clearly

For any client or project, the platform should answer:

1. What do we already know?
2. What is the current portal or delivery reality?
3. What should we do next?
4. What should be validated live with the client?
5. What can the platform execute directly versus only plan for?
6. What workstreams are likely to come next?
7. What changed since last time?

### Product rule

Deploy OS should not force every engagement through the same delivery ritual.

It should adapt around the job Muloo is actually doing.

## 2. Engagement modes

The product should formalise five primary engagement modes.

These are not just labels. They should drive defaults, navigation, prompts, suggested outputs, and what the workspace shows first.

### 1. New Implementation

Use when:

- the client is new
- HubSpot is newly purchased or newly committed
- Muloo is shaping the first real operating model

Priority:

- discovery
- blueprint
- scope and approval
- delivery sequencing

Primary questions:

- what needs to be designed from scratch?
- what should the initial architecture be?
- what is in scope for phase one?

### 2. Audit & Optimisation

Use when:

- the client already has HubSpot
- the work starts with diagnosis
- Muloo needs to understand portal quality, process gaps, reporting gaps, or technical debt

Priority:

- portal audit
- prior context
- current state diagnosis
- meeting prep
- recommendations

Primary questions:

- what is already there?
- what is broken or missing?
- what should be fixed first?
- what is realistic given the portal tier and current process maturity?

### 3. Follow-on Work

Use when:

- Muloo has done work for the client before
- this is not a fresh implementation
- the client is returning with additional requirements, scoped changes, or new priorities

Priority:

- prior project memory
- current request unpacking
- portal state
- change impact
- scope conversion

Primary questions:

- what did Muloo already implement?
- what is this request really asking for?
- how much new architecture versus extension is needed?
- what is the cleanest way to scope it?

### 4. Workshop / Sprint

Use when:

- Muloo is preparing for a working session, onsite sprint, or structured meeting sequence
- the immediate goal is to get ahead of the client interaction

Priority:

- prep brief
- agenda
- open questions
- assumptions
- live working notes
- decision capture

Primary questions:

- what should Muloo walk into the room knowing?
- what must be validated onsite?
- what sequence should the session follow?
- what outputs should come out of the session?

### 5. Retainer / Ongoing Support

Use when:

- the client relationship is ongoing
- work comes in as incremental requests
- the need is prioritisation, lightweight scoping, and safe execution

Priority:

- request intake
- portal ops
- change queue
- execution logs
- visible status

Primary questions:

- what is the request?
- can it be executed safely now?
- does it need a plan, a scope, or a run?
- what changed in the portal since last time?

### Mode mapping recommendation

The platform should keep a single primary engagement mode on the project, but allow overlays.

Examples:

- `Audit & Optimisation` + `Workshop / Sprint`
- `Follow-on Work` + `Retainer / Ongoing Support`

That gives flexibility without turning the model into chaos.

## 3. Workspace clusters

Projects and clients should not be treated as rigid pipelines.

They should behave like containers with optional work clusters.

### Recommended clusters

#### Context

Purpose:

- understand the client, project, history, and known reality

Should include:

- client profile
- prior projects
- prior deliverables
- prior recommendations
- stakeholder memory
- uploaded notes and source material

Current build status:

- partially present
- project summary exists
- prepare workspace now begins to gather context
- client-level memory is still thin

#### Diagnose

Purpose:

- inspect current platform and operational reality

Should include:

- portal audit
- findings
- recommendations
- current-state notes
- visible blockers and risks

Current build status:

- strong progress
- portal audit is now a meaningful product capability

#### Prepare

Purpose:

- get Muloo ahead of the next client interaction

Should include:

- meeting brief
- workshop agenda
- open questions
- assumptions to validate
- prep notes
- session outputs

Current build status:

- now emerging well
- prepare workspace exists
- AI prepare brief is now in place
- live workshop capture and decision logging are still missing

#### Plan

Purpose:

- turn knowledge into a recommended approach and likely workstreams

Should include:

- workstream shaping
- blueprint
- phased approach
- options
- rough sequencing
- dependencies

Current build status:

- blueprint and quote paths exist
- planning is still too delivery-template-heavy for optimisation work

#### Scope

Purpose:

- convert selected work into a clear commercial and delivery boundary

Should include:

- scope definition
- assumptions
- exclusions
- phase boundaries
- approval path

Current build status:

- quote and approval capability exists
- more flexible scoping for follow-on work is still needed

#### Deliver

Purpose:

- run, track, and govern execution

Should include:

- runs
- boards
- change management
- execution logs
- status visibility

Current build status:

- strong underlying direction
- operations are visible, but long-running AI work should move more consistently into Runs

### Cluster rule

Every engagement mode should not show every cluster equally.

Examples:

- `New Implementation`: Context -> Discover -> Plan -> Scope -> Deliver
- `Audit & Optimisation`: Context -> Diagnose -> Prepare -> Plan -> Scope
- `Workshop / Sprint`: Context -> Prepare -> Diagnose -> Plan
- `Retainer / Ongoing Support`: Context -> Deliver -> Portal Ops -> Change

That is the main UX principle needed from here.

## 4. Feature map against the target model

This section maps the current build to the intended operating model.

### Workspace layer

#### Command Centre

Role:

- daily operational cockpit

Current state:

- useful and present
- needs stronger prioritisation and cleaner next-best-action guidance

#### Sidebar and information architecture

Role:

- top-level mental model for the platform

Current state:

- improved
- now grouped into Workspace, Delivery, Operations, and Admin
- still needs one more pass to become mode-aware and less dense at the project level

#### Clients workspace

Role:

- client-level memory, portal association, and relationship overview

Current state:

- present
- needs stronger longitudinal history and more visible prior work context

### Project layer

#### Project summary

Role:

- central workspace container

Current state:

- flexible enough to continue evolving
- still carries some legacy “linear pipeline” assumptions

#### Adaptive workflow nav

Role:

- mode-based project navigation

Current state:

- good direction
- one of the most important alignment moves already made
- should become even more assertive about showing the right cluster order by mode

#### Prepare workspace

Role:

- meeting and workshop readiness

Current state:

- now strong enough to be a real wedge into the new operating model
- should become the default landing zone for optimisation and workshop engagements

#### Audit workspace

Role:

- diagnose the portal and produce recommendations

Current state:

- strategically important
- reliability improved significantly
- should feed directly into Prepare and Plan, not feel like an isolated tab

#### Inputs / discovery / proposal / blueprint / quote

Role:

- structure knowledge and turn it into planned work

Current state:

- powerful for greenfield and classic delivery
- too rigid if treated as the only valid path

### Operations layer

#### Portal Ops

Role:

- natural-language request intake against a client portal

Current state:

- strategically right
- should become the lightweight execution and planning tool for retainer and follow-on work
- needs clearer output modes and stronger visible capability boundaries

#### Runs

Role:

- home for long-running system and AI work

Current state:

- underused relative to its importance
- should become central for audit runs, prep generation, and operator requests

#### Agents

Role:

- configuration and oversight of specialised agent behaviours

Current state:

- useful, but too easy to confuse with end-user workflow
- should stay secondary to AI Routing and actual task outcomes

#### AI Routing

Role:

- source of truth for workflow-level model/provider choice

Current state:

- important and correct
- should remain the execution control plane

## 5. Main gaps

These are the highest-value gaps still open in the build.

### 1. Client memory is not strong enough yet

The system still does not make it easy enough to answer:

- what did we do before?
- what changed since then?
- what was previously recommended?
- what decisions were already made?

This is the biggest structural gap for existing-client work.

### 2. Long-running AI work is still too request-response shaped

Audit and prepare flows should feel like managed runs, not fragile button clicks.

Needed:

- queued status
- running status
- completion state
- failure state with clear reason
- history of runs per project or client

### 3. Capability boundaries are not explicit enough

The platform must clearly distinguish:

- executable now
- plannable only
- partially automatable
- blocked by portal tier or missing scopes
- blocked by unsupported API coverage

This needs to show up both in UI and backend responses.

### 4. Existing-client work still lacks a dominant fast path

The platform now has the right ingredients, but the flow should become more obvious:

1. pick client
2. inspect prior context
3. run audit
4. generate prep brief
5. capture client request
6. shape workstreams
7. scope next phase

That should feel like a first-class product path, not a clever use of several features.

### 5. Some project pages still assume a single universal lifecycle

A project should be a workspace with optional clusters, not a mandatory checklist.

This is partly solved and partly still embedded in the old structure.

### 6. Scenario-level product testing is still too light

The platform needs confidence against real Muloo operating scenarios, not only generic smoke tests.

## 6. Scenario review

The platform should be judged against real scenarios Muloo faces repeatedly.

### Scenario A: brand new client, fresh implementation

Desired flow:

- create project
- run discovery
- generate blueprint
- produce scope
- move into delivery

Assessment:

- already reasonably well supported

### Scenario B: existing HubSpot client needs optimisation

Desired flow:

- pull prior work
- inspect current portal
- run audit
- generate meeting brief
- shape optimisation workstreams

Assessment:

- now meaningfully supported
- still needs stronger client memory and a more opinionated prepare-first landing experience

### Scenario C: follow-on request from an existing client

Desired flow:

- retrieve what Muloo has done before
- understand the new request quickly
- determine whether it is a plan, scope, or direct action
- route safely

Assessment:

- partially supported
- Portal Ops helps, but the end-to-end “returning client change request” path needs clearer product shape

### Scenario D: onsite workshop preparation

Desired flow:

- gather context
- run audit
- synthesise knowns and unknowns
- prepare agenda and questions
- log outputs after the session

Assessment:

- now newly supported through Prepare
- still missing strong session capture and decision logging

### Scenario E: retained client needs lightweight operational help

Desired flow:

- intake request
- decide execution type
- run or plan safely
- log result
- preserve history

Assessment:

- promising
- needs Runs and request history to feel operationally complete

## 7. Recommended next build order

This is the recommended build sequence from here.

### Step 1: Lock engagement modes into the data model and UI

Build:

- formal mode definitions
- mode selection and overlays
- mode-driven defaults
- mode-specific landing pages

Why first:

- this becomes the organising principle for navigation, prompts, outputs, and scope handling

### Step 2: Move long-running AI workflows into Runs

Build:

- queued run creation for audit, prepare brief, and portal ops planning
- run status and history
- project and client run feeds

Why second:

- this will dramatically improve trust, visibility, and operational stability

### Step 3: Build a real client memory layer

Build:

- prior audits
- prior workstreams
- prior scoped work
- decision history
- meeting notes timeline
- portal snapshots over time

Why third:

- this is the unlock for optimisation, follow-on work, and retained support

### Step 4: Make Prepare the centre of optimisation and workshop work

Build:

- generated prep brief
- workshop agenda
- open questions tracker
- assumption capture
- session notes and decisions
- direct handoff into workstreams or scope

Why fourth:

- this is where Muloo gets ahead of the client rather than reacting during the meeting

### Step 5: Strengthen Portal Ops capability contracts

Build:

- explicit output modes
- clearer execution versus planning states
- capability badges
- portal tier and scope-aware cautions
- request history

Why fifth:

- Portal Ops becomes much more valuable once the surrounding operating model is settled

### Step 6: Add scenario-level end-to-end tests

Build:

- optimisation flow test
- follow-on work test
- workshop prep test
- direct action versus manual plan routing test
- AI routing provider test

Why sixth:

- confidence should match product reality, not just code health

### Step 7: Continue simplifying navigation

Build:

- cleaner project headers
- fewer generic tabs
- stronger cluster-based entry points
- more visible “next best action” prompts

Why seventh:

- navigation should be refined after mode, runs, and memory shape the right behaviour

## 8. Immediate practical recommendation

If the goal is to make the platform feel like Jarrud's actual operating system as quickly as possible, the next three build moves should be:

1. convert Audit, Prepare, and Portal Ops into tracked Runs
2. add client memory and meeting history to Prepare
3. make optimisation and workshop modes land directly in Prepare instead of generic summary first

That would make the platform noticeably more useful for real existing-client work almost immediately.

## 9. Final conclusion

The platform is in reach.

It is no longer missing the basic ingredients.

It is now at the stage where success depends on alignment:

- one clear platform promise
- a small number of explicit engagement modes
- cluster-based workspaces instead of one rigid pipeline
- stronger client memory
- visible execution boundaries
- run-based handling of long AI workflows

If those pieces are delivered, Muloo Deploy OS can become the thing it is trying to become:

> the internal operating system Muloo uses to understand, shape, and deliver client work with far less friction.
