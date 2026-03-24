# Muloo Deploy OS

Muloo Deploy OS is Muloo's internal delivery orchestration system for turning HubSpot discovery into structured, standardised, and executable implementation work.

## Status

The product definition has been reset around the v1 orchestration model in `docs/`.

The current codebase still contains useful prototype assets:

- internal Next.js shell and API scaffolding
- file-backed project/template data
- early HubSpot execution slices for properties and pipelines
- exploratory project authoring and design editors

Those assets should be treated as reusable prototype components, not as the locked product architecture for v1.

## Source Of Truth

Start here before changing product code:

- [Product Scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Domain Model](docs/domain-model.md)
- [Discovery Schema](docs/discovery-schema.md)
- [Standards Matrix](docs/standards-matrix.md)
- [Execution Matrix](docs/execution-matrix.md)
- [MVP Wireframes](docs/mvp-wireframes.md)

## What v1 must do

1. Create a project tied to a client and HubSpot portal.
2. Capture or import structured discovery inputs.
3. Apply Muloo standard setup modules based on hubs, tiers, and use cases.
4. Generate a blueprint of deliverables and recommended architecture.
5. Convert the blueprint into clear tasks with dependencies and execution types.
6. Manage those tasks on the internal project board and track execution status.

## What v1 is not

- not a client-facing product
- not a replacement for HubSpot
- not an all-purpose AI agent
- not a full PSA, ERP, CRM, and PM suite
- not broad end-to-end HubSpot automation on day one

## Current implementation note

If code and docs disagree, follow the docs in `docs/` and treat the code as behind the target product model until it is rebuilt to match.
