# Standards Matrix

## Purpose

This matrix defines the initial Muloo standards library for v1 and when each module should apply.

| Module                    | Category  | Applies when                                    | Typical triggers                                                                | Core outputs                                                                                                   |
| ------------------------- | --------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CRM Core Foundation       | Core CRM  | Any HubSpot implementation                      | Any project with CRM objects, ownership, lifecycle, or governance in scope      | Naming conventions, property grouping, owner model, lifecycle baseline, governance checklist                   |
| Sales Hub Core            | Sales     | Sales Hub is active or planned                  | Deal pipeline setup, lead management, SDR/AE flow, sales reporting needs        | Pipeline rules, lead status model, sales property baseline, task process suggestions, reporting foundation     |
| Marketing Hub Foundation  | Marketing | Marketing Hub is active or planned              | Segmentation, forms, campaigns, lead capture, lifecycle conversion logic        | List baseline, form naming, campaign structure, lifecycle conversion suggestions, marketing reporting baseline |
| Service Hub Core          | Service   | Service Hub is active or planned                | Ticket pipelines, support categories, routing logic, help desk or portal needs  | Ticket framework, ticket properties, routing concepts, portal requirements, service reporting baseline         |
| CMS / Website Foundation  | CMS       | CMS or website work is in scope                 | Website rebuild, region model, page templates, SEO or migration needs           | Content structure, localisation guidance, theme/setup checklist, template requirements                         |
| Data Migration Foundation | Data      | Migration, imports, or data cleanup is required | Source systems, field mapping, imports, dedupe concerns, cutover planning       | Import checklist, source mapping, data quality flags, cutover considerations                                   |
| Reporting Foundation      | Reporting | Reporting is explicitly in scope                | Executive dashboards, manager views, rep views, attribution or dependency needs | Dashboard categories, executive views, team/user views, reporting dependency flags                             |

## Recommendation rules

### Always apply

- `CRM Core Foundation`

### Apply by hub

- `Sales Hub Core` when sales process design or Sales Hub scope exists
- `Marketing Hub Foundation` when campaigns, forms, segmentation, or lifecycle marketing logic is in scope
- `Service Hub Core` when tickets, SLAs, or support routing is in scope
- `CMS / Website Foundation` when website or CMS implementation is in scope

### Apply by use case

- `Data Migration Foundation` when imports, sync mapping, cleanup, or migration appears in discovery
- `Reporting Foundation` when reporting is a deliverable or a dependency for another workstream

## Override rules

- Operators can add or remove modules manually.
- Manual overrides must record a reason.
- Blueprint generation should preserve both suggested modules and overridden modules for auditability.
