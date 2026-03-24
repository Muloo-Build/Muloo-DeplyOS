# MVP Wireframes

## Screen map

The v1 product should launch with ten workflow screens.

## 1. Projects Dashboard

Purpose:

- list projects
- filter by client, owner, and state
- show current phase and blockers

Wireframe:

```text
+----------------------------------------------------------------------------------+
| Muloo Deploy OS | Projects | Discovery | Blueprints | Tasks | QA | Activity      |
+----------------------------------------------------------------------------------+
| Filters: [Owner v] [State v] [Client] [Search______________________________]     |
+----------------------------------------------------------------------------------+
| Project                 Client        Owner      Phase               Status       |
| Northstar RevOps        Northstar     Jarrud     Discovery Complete  Blocked      |
| Apex Sales Rollout      Apex          Sam        In Execution        On Track     |
| EPIUSE Service Setup    EPIUSE        Jarrud     Pending Approval    Review       |
+----------------------------------------------------------------------------------+
| Right rail: upcoming approvals | blocked projects | recent board failures         |
+----------------------------------------------------------------------------------+
```

## 2. New Project Screen

Purpose:

- create project
- link client and portal
- define scope and selected modules

```text
+--------------------------------------------------------------+
| New Project                                                  |
+--------------------------------------------------------------+
| Project name             [_______________________________]   |
| Client                   [Select client__________________]   |
| HubSpot portal           [Connect/select portal__________]   |
| Scope type               [New onboarding v]                  |
| Owner                    [Select owner___________________]   |
| Modules in scope         [Sales] [Marketing] [Service]       |
| Target date              [YYYY-MM-DD]                        |
| [Create draft project]                                        |
+--------------------------------------------------------------+
```

## 3. Client + Portal Context Screen

Purpose:

- confirm pulled HubSpot context
- show subscription, access, and integration constraints

```text
+----------------------------------------------------------------------------------+
| Client: Northstar | Portal: 12345678 | Connection: Connected                     |
+----------------------------------------------------------------------------------+
| Active hubs | Sales Enterprise | Marketing Pro | Service Free                    |
| Region      | EU                                                                     |
| Admin access| Confirmed                                                              |
| Integrations| Salesforce, ZoomInfo, Typeform                                         |
| Risks       | Missing super admin for service inbox                                  |
+----------------------------------------------------------------------------------+
| [Confirm context] [Flag issue] [Return to project]                                 |
+----------------------------------------------------------------------------------+
```

## 4. Discovery Workspace

Purpose:

- capture structured discovery
- import structured discovery
- save versions and flag gaps

```text
+----------------------------------------------------------------------------------+
| Discovery Workspace | Version 3 | Status: In Progress                            |
+----------------------------------------------------------------------------------+
| Left nav: Business | Platform | CRM | Sales | Marketing | Service | CMS | Data  |
+----------------------------------------------------------------------------------+
| Section form                                                               [Save] |
| Missing fields: lifecycle stages, ownership model, import requirements            |
| Open questions: 4                                                                 |
+----------------------------------------------------------------------------------+
| [Import notes] [Save draft] [Mark discovery complete]                             |
+----------------------------------------------------------------------------------+
```

## 5. Standards Application Screen

Purpose:

- show recommended modules
- explain why each one applies
- allow add/remove overrides

```text
+----------------------------------------------------------------------------------+
| Standards Application                                                            |
+----------------------------------------------------------------------------------+
| Recommended modules                                                              |
| [x] CRM Core Foundation       Reason: all projects require governance baseline    |
| [x] Sales Hub Core            Reason: sales pipeline redesign in discovery        |
| [ ] Marketing Hub Foundation  Reason: inactive; not in scope                      |
| [x] Data Migration Foundation Reason: ERP import and dedupe concerns              |
+----------------------------------------------------------------------------------+
| Override notes [______________________________________________________________]  |
| [Apply modules] [Back to discovery]                                               |
+----------------------------------------------------------------------------------+
```

## 6. Blueprint Screen

Purpose:

- show architecture summary
- show deliverables, phases, dependencies, and risks

```text
+----------------------------------------------------------------------------------+
| Blueprint                                                                        |
+----------------------------------------------------------------------------------+
| Architecture summary                                                             |
| - Standard CRM baseline with Sales Hub and Data Migration modules                |
| - Single global contact model with regional ownership rules                      |
+----------------------------------------------------------------------------------+
| Deliverables                 Phase           Dependencies            Risk          |
| Contact property framework   Foundation      None                    Low           |
| Deal pipelines               Sales setup     Lifecycle definition    Medium        |
| Migration mapping            Data prep       Property framework      High          |
+----------------------------------------------------------------------------------+
| [Approve blueprint] [Regenerate] [Edit assumptions]                              |
+----------------------------------------------------------------------------------+
```

## 7. Task Generation Screen

Purpose:

- review generated tasks
- edit priority, dependencies, and execution type
- approve publishing to the internal board

```text
+----------------------------------------------------------------------------------+
| Task Generation                                                                   |
+----------------------------------------------------------------------------------+
| Task                                Execution  Depends on        QA   Approval    |
| Create contact properties           API        None              Yes  Yes         |
| Define lifecycle stage rules        Manual     None              No   Yes         |
| Validate ticket routing in UI       Agent      Ticket setup      Yes  No          |
+----------------------------------------------------------------------------------+
| [Generate tasks] [Approve to board] [Export review]                               |
+----------------------------------------------------------------------------------+
```

## 8. Execution Planning Screen

Purpose:

- group tasks by execution type
- prepare jobs and approvals

```text
+----------------------------------------------------------------------------------+
| Execution Planning                                                                |
+----------------------------------------------------------------------------------+
| API queue            | Agent queue             | Manual queue                      |
| 12 ready             | 3 waiting approval      | 8 assigned                        |
| 4 blocked            | 1 blocked               | 2 awaiting stakeholder input      |
+----------------------------------------------------------------------------------+
| Selected task: Create contact properties                                           |
| Payload preview | approval status | execution history                             |
+----------------------------------------------------------------------------------+
| [Queue job] [Request approval] [Open on board]                                    |
+----------------------------------------------------------------------------------+
```

## 9. QA and Approval Screen

Purpose:

- review completed work
- run checklists
- approve or reject deployment readiness

```text
+----------------------------------------------------------------------------------+
| QA and Approval                                                                   |
+----------------------------------------------------------------------------------+
| Deliverable: Deal pipelines                                                       |
| Checklist: [x] stages exist [x] order valid [ ] owner rules validated            |
| Reviewer notes: [_____________________________________________________________]  |
| Result: [Pass v]                                                                   |
+----------------------------------------------------------------------------------+
| [Save QA result] [Reject] [Approve for deployment]                                |
+----------------------------------------------------------------------------------+
```

## 10. Activity / Audit Log Screen

Purpose:

- show board history
- show execution logs
- show deployment completion record

```text
+----------------------------------------------------------------------------------+
| Activity Log                                                                       |
+----------------------------------------------------------------------------------+
| Timestamp            Type             Object                Result                 |
| 2026-03-11 09:14     Board publish    Task batch 12         Succeeded              |
| 2026-03-11 10:03     API execution    Contact properties    Succeeded              |
| 2026-03-11 10:21     Approval         Blueprint             Pending                |
| 2026-03-11 11:05     QA check         Deal pipelines        Failed                 |
+----------------------------------------------------------------------------------+
| [Open log] [Filter] [Export]                                                      |
+----------------------------------------------------------------------------------+
```
