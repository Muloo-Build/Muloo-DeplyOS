# Execution Matrix

## Purpose

This matrix defines how generated tasks should be classified in v1.

## Execution types

| Execution type | Use when | Typical examples | Benefits | Risks |
| --- | --- | --- | --- | --- |
| API executable | HubSpot APIs can safely perform the task | Create properties, create custom objects, create associations, create supported pipelines/stages, read portal settings | Reliable, repeatable, testable | Limited by API coverage and change safety |
| Agent executable | The task requires UI interaction in systems with incomplete APIs | UI-only settings, guided browser validation, settings screens not exposed in API | Fills API gaps | Less predictable, harder to test, needs strong guardrails |
| Manual | The task requires judgment, approval, or ambiguous design work | Architecture decisions, naming approvals, content strategy, stakeholder validation, reporting logic review | Preserves quality on high-ambiguity work | Slower and less scalable |

## Default routing rule

1. Try `api`.
2. If API coverage is insufficient but the task is still operationally safe, classify as `agent`.
3. If the task is strategic, ambiguous, risky, or approval-heavy, classify as `manual`.

## v1 classification examples

| Task category | Example task | Default execution type | Approval required |
| --- | --- | --- | --- |
| Portal context | Read subscription tier and active hubs | API | No |
| CRM properties | Create standard contact properties | API | Yes, if production |
| CRM properties | Rename existing property or change options | Manual | Yes |
| Pipelines | Create simple pipeline/stage structure where API is safe | API | Yes |
| Pipelines | Review pipeline architecture with stakeholder nuance | Manual | Yes |
| UI settings | Configure a UI-only HubSpot setting | Agent | Yes |
| Discovery cleanup | Resolve missing requirements or contradictions | Manual | No |
| Reporting | Generate recommended dashboard blueprint | Manual | Yes |
| QA | Validate field presence or object structure in UI | Agent | No |
| QA | Sign off final deployment | Manual | Yes |

## Required task metadata

Every generated task should store:

- `execution_type`
- `qa_required`
- `approval_required`
- `dependency_ids`
- `assignee_type`
- `status`

## Guardrail rules

- Never default everything to agent execution.
- Production write actions should require explicit approval.
- Risky update actions should prefer manual review until proven safe.
- Execution jobs must log payload, outcome, and errors regardless of execution type.
