# Domain Model

## Core relationships

```mermaid
erDiagram
    PARTNER ||--o{ PARTNER_CLIENT_LINK : can_access
    CLIENT_GROUP ||--o{ CLIENT : contains
    CLIENT ||--o{ PARTNER_CLIENT_LINK : visible_to
    CLIENT ||--o{ PROJECT : owns
    HUBSPOT_PORTAL ||--o{ PROJECT : targets
    PROJECT ||--o{ DISCOVERY_SUBMISSION : captures
    PROJECT ||--o{ BLUEPRINT : produces
    BLUEPRINT }o--o{ STANDARD_MODULE : applies
    BLUEPRINT ||--o{ DELIVERABLE : scopes
    PROJECT ||--o{ TASK : tracks
    DELIVERABLE ||--o{ TASK : breaks_into
    TASK ||--o{ EXECUTION_JOB : executes
    PROJECT ||--o{ QA_CHECK : validates
    TASK ||--o{ QA_CHECK : may_require
    DELIVERABLE ||--o{ QA_CHECK : may_require
    PROJECT ||--|| DEPLOYMENT_LOG : closes_with

    PARTNER {
      string partner_id PK
      string name
      string relationship_type
      string notes
    }

    CLIENT_GROUP {
      string client_group_id PK
      string name
      string notes
    }

    CLIENT {
      string client_id PK
      string client_group_id FK
      string name
      string industry
      string region
      string website
      string current_stack
      string hubspot_relationship_status
      string linked_hubspot_company_record
    }

    PARTNER_CLIENT_LINK {
      string partner_client_link_id PK
      string partner_id FK
      string client_id FK
      string visibility_scope
      string notes
    }

    HUBSPOT_PORTAL {
      string portal_id PK
      string hubspot_account_name
      string subscription_tiers
      string active_hubs
      string portal_region
      string admin_access_status
      string auth_connection_status
      string notes
    }

    PROJECT {
      string project_id PK
      string client_id FK
      string portal_id FK
      string project_name
      string scope_type
      string status
      string owner
      date start_date
      date target_date
      string selected_modules
      string current_phase
    }

    DISCOVERY_SUBMISSION {
      string discovery_id PK
      string project_id FK
      int version
      string source_type
      json raw_input
      json structured_output
      json assumptions
      json open_questions
      string status
    }

    STANDARD_MODULE {
      string module_id PK
      string name
      string category
      string hub_type
      string tier_requirements
      json applicable_conditions
      json default_deliverables
      json default_tasks
    }

    BLUEPRINT {
      string blueprint_id PK
      string project_id FK
      int discovery_version
      json applied_modules
      text architecture_summary
      json deliverables_summary
      json risk_flags
      string approval_status
    }

    DELIVERABLE {
      string deliverable_id PK
      string blueprint_id FK
      string name
      string category
      string phase
      string priority
      text description
      json dependencies
      string status
    }

    TASK {
      string task_id PK
      string project_id FK
      string deliverable_id FK
      string title
      text description
      string category
      string execution_type
      json dependency_ids
      string board_card_id
      string assignee_type
      boolean qa_required
      boolean approval_required
      string status
    }

    EXECUTION_JOB {
      string job_id PK
      string task_id FK
      string execution_method
      json payload
      datetime started_at
      datetime completed_at
      string result_status
      text output_log
      text error_log
    }

    QA_CHECK {
      string qa_id PK
      string project_id FK
      string task_id FK
      string deliverable_id FK
      json checklist
      string reviewer
      string result
      text notes
      datetime completed_at
    }

    DEPLOYMENT_LOG {
      string deployment_log_id PK
      string project_id FK
      json completed_items
      json exceptions
      json risks
      string approved_by
      datetime completed_at
    }
```

## Relationship notes

- A `Partner` is not the same thing as a `Client`. It represents an intermediary, implementation partner, or commercial route to the work.
- A `Client Group` can contain multiple operational `Client` entities that should still be modeled separately when they have distinct businesses or HubSpot portals.
- A `Project` belongs to exactly one `Client` and one target `HubSpot Portal`.
- A `Project` should not be reclassified to the partner just because the work is being delivered through that partner.
- Partner visibility should be granted through explicit partner-client relationships or access rules.
- A `Project` can have multiple `Discovery Submission` versions, but the approved blueprint should point to one discovery version.
- A `Blueprint` can apply multiple `Standard Module` records.
- `Deliverable` is the scoped output layer between blueprint design and execution tasks.
- `Task` is the operational unit that gets tracked on the internal board and routed by execution type.
- `Execution Job` is optional and only exists when a task is actually run through an API or agent path.
- `QA Check` may attach to a task or a deliverable depending on the level being validated.
- A `Deployment Log` closes the project and records approved outcomes and exceptions.

## Modeling examples

- `Tusk` can be modeled as a `Partner`
- `Magnisol` can be modeled as a `Client`
- `Tusk -> Magnisol` visibility should be represented through a partner-client link, not by making `Tusk` the client
- `EPIUSE` can be modeled as a `Client Group`
- `EPIUSE UK`, `EPIUSE ZA`, `EPIUSE AUS`, `EPIUSE USA West`, `EPIUSE Brazil`, `EPIUSE Spain`, and `EPIUSE DACH` should be modeled as separate `Client` entities linked to the `EPIUSE` client group because they have separate HubSpot portals and operate as distinct businesses
