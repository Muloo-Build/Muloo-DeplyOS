# Agent Delivery Model

## Purpose

Deploy OS should treat agents as delivery participants, not just document-generation helpers.

The goal is to move from:

- discovery and scoping assistance only

into:

- delivery planning
- agent assignment
- execution queueing
- run visibility
- measured delivery improvement over time

This model should support both discovery-led implementation projects and standalone scoped jobs.

## Core rule

Every delivery task must be classed in a way that makes execution responsibility explicit.

Deploy OS should support these delivery participant types:

- `Human`
- `Agent`
- `Client`

This is already enough for the current product stage.

Later, the internal logic can evolve toward a richer model such as:

- human-led
- agent-assisted
- agent-executable
- client dependency
- approval gate

## Agent role in the workflow

Agents should be involved in three distinct layers.

### 1. Planning

Agents help shape delivery work by:

- producing discovery summaries
- producing technical blueprints
- proposing phased implementation plans
- suggesting delivery boards
- identifying risks, dependencies, and missing information

### 2. Execution support

Agents can prepare delivery work by:

- drafting implementation checklists
- validating documentation completeness
- producing QA checklists
- generating first-pass technical configs
- summarizing supporting notes and requirements

### 3. Execution runs

For tasks that are ready to be handed to an agent, Deploy OS should allow:

- assigning a named agent to the task
- queueing an agent run from the delivery board
- tracking the queued run in `Runs`
- later: approving outputs before they are treated as complete

## Execution readiness ladder

A task should only become agent-runnable once it meets the minimum readiness criteria.

### Level 0: Not agent-ready

Examples:

- unclear scope
- open architecture decisions
- missing stakeholder approval
- incomplete inputs

These tasks remain human-owned.

### Level 1: Agent-assisted

Examples:

- checklist generation
- QA preparation
- documentation drafting
- summarizing or restructuring requirements

Human remains responsible for the final output.

### Level 2: Agent-executable with review

Examples:

- setting up repeatable configurations
- creating standardized assets from a known template
- generating portal setup tasks from an approved blueprint
- preparing system-page scaffolds or property lists

Agent performs work, but human reviews before completion.

### Level 3: Agent-executable with minimal review

Examples:

- low-risk repetitive setup tasks
- repeatable template deployment
- validation and regression checks

This level should only be used after enough evidence exists that the workflow is stable.

## Current product behavior

Deploy OS now supports the first execution bridge:

- tasks can be assigned to a named agent
- agent-assigned tasks can be queued into the `Runs` workspace
- queued runs are tracked as execution jobs with project and task context

This is intentionally a dry-run execution layer first.

The system should prove orchestration before it automates high-risk work.

## Task requirements for agent assignment

A delivery task should only be assigned to an agent when:

- the task title is clear
- the expected outcome is explicit
- the project context exists
- dependencies are known
- the task is not blocked by missing client input
- the task is repeatable or structured enough to hand off safely

If these conditions are not met, the system should default back to `Human`.

## Runs model

Each queued agent run should capture:

- project
- task
- agent id
- agent name
- provider
- model
- execution mode
- status
- logs / output
- timestamps

This creates a delivery audit trail.

## Delivery board behavior

The delivery board is the operational handoff point.

From the board, the user should be able to:

- assign a task to a human, client, or agent
- edit task details
- move task status
- queue an agent run when the task is agent-owned
- compare planned vs actual hours

Later enhancements should include:

- due dates
- dependencies
- comments and activity
- approval checkpoints
- blockers linked to missing client inputs

## Service-family alignment

Agent behavior should eventually vary by service family:

- `HubSpot Architecture`
- `Custom Engineering`
- `AI Automation`

Examples:

- HubSpot Architecture agents may focus on portal setup, objects, workflows, and QA
- Custom Engineering agents may focus on implementation steps, integration scaffolds, and technical validation
- AI Automation agents may focus on prompt chains, automations, classification, and workflow orchestration

## Model-routing principle

Different AI models will be better suited to different delivery tasks.

Deploy OS should support routing by workflow, not by one global model choice.

Examples:

- discovery extract -> optimized summarization model
- blueprint generation -> structured planning model
- JSON repair -> reliable formatting model
- delivery QA -> high-precision review model
- future agent execution -> task-specific operational model

This principle is already reflected in the workspace AI routing settings.

## Recommended next steps

### Near term

1. keep queueing agent runs from the delivery board
2. improve the `Runs` page to show richer status and output
3. store run results back against tasks when appropriate
4. add agent execution notes or output summaries

### Mid term

5. add execution readiness fields to tasks
6. add approval-before-complete for agent-executed tasks
7. support template-driven agent task bundles
8. introduce model/provider selection by task type or service family

### Later

9. allow true task execution through connected APIs and tools
10. let agents update task status and outputs directly after reviewed execution
11. compare agent-delivered hours saved vs human-planned hours

## Product principle

Deploy OS should not pretend agents are magical.

The platform should:

- make work legible for humans
- make work structured for agents
- keep an audit trail of execution
- increase agent responsibility only when the workflow proves safe and repeatable
