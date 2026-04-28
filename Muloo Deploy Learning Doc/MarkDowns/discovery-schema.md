# Discovery Schema

## Purpose

This schema defines the exact sections and fields required for structured discovery intake in v1.

The authoritative machine-readable contract lives at [specs/discovery-submission.schema.json](../specs/discovery-submission.schema.json).

## Envelope

Each discovery submission should contain:

- `discovery_id`
- `project_id`
- `version`
- `source_type`
- `captured_at`
- `captured_by`
- `status`
- `business_context`
- `platform_context`
- `crm_architecture`
- `sales_requirements`
- `marketing_requirements`
- `service_requirements`
- `cms_requirements`
- `integrations_and_data`
- `governance_and_ops`
- `risks_and_assumptions`
- `open_questions`

## Sections

### A. Business context

- `company_name`
- `business_model`
- `region`
- `team_structure`
- `growth_goals`
- `implementation_objectives`

### B. Platform context

- `current_hubspot_usage`
- `active_hubs`
- `subscription_tiers`
- `existing_crm_cleanliness`
- `connected_tools`
- `migration_needs`

### C. CRM architecture

- `objects_in_scope`
- `contact_company_rules`
- `deal_pipelines`
- `lifecycle_stages`
- `lead_statuses`
- `ownership_model`
- `associations`

### D. Sales requirements

- `pipeline_requirements`
- `qualification_logic`
- `sdr_ae_process`
- `task_automation_needs`
- `reporting_needs`

### E. Marketing requirements

- `segmentation`
- `campaign_structure`
- `forms`
- `lead_capture`
- `email_needs`
- `reporting_needs`

### F. Service requirements

- `tickets`
- `support_categories`
- `routing_logic`
- `slas`
- `portal_or_help_centre_requirements`

### G. CMS / website requirements

- `website_in_scope`
- `page_structure`
- `brand_or_region_model`
- `smart_content_needs`
- `blog_seo_content_migration_needs`

### H. Integrations and data

- `source_systems`
- `sync_direction`
- `field_mapping_needs`
- `import_requirements`
- `dedupe_concerns`

### I. Governance and ops

- `naming_conventions`
- `permissions`
- `qa_requirements`
- `training_needs`
- `handover_needs`

### J. Risks and assumptions

- `blockers`
- `dependencies`
- `access_issues`
- `custom_dev_likely`
- `assumptions`

## Modeling rules

- Freeform text is allowed for v1, but each section must remain structurally separated.
- Arrays should be used for repeatable items such as hubs, tools, objects, pipelines, blockers, and open questions.
- Optional sections should still exist in the payload with empty values if they were reviewed and found not applicable.
- The schema should support imported discovery and manually captured discovery through the same structure.
- `structured_output` should be derivable from imported notes or transcripts, but the stored submission should remain a normalized object, not just raw text.

## Implementation note

This schema is designed for delivery orchestration. It is intentionally biased toward scoping, planning, execution routing, QA, and approval readiness rather than generic CRM note-taking.
