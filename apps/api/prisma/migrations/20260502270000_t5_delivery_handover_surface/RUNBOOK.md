# T5 — Delivery + handover surface (additive)

## What this migration does

Backs the four T5 sub-steps:

| Sub-step | Schema change                                                                 |
| -------- | ----------------------------------------------------------------------------- |
| T5.1     | `Task.hubspotTicketId`, `Task.sourceWorkstreamItemId` (+ indexes)             |
| T5.2     | New `HandoverDoc` table (one row per project, `projectId` unique)             |
| T5.3     | `Project.npsScore`, `npsNote`, `npsCapturedAt`, `completedAt`; `DiscoveryEvidence.isArchived` |
| T5.4     | `Project.bornFromProjectId` (self-FK), `Retainer.bornFromProjectId` (FK → Project) |

All ALTER TABLEs use `ADD COLUMN IF NOT EXISTS`; foreign keys and unique
indexes are wrapped in `DO $$ ... pg_constraint` guards so re-running on a
partially-applied DB is safe.

## Decisions baked into the migration

- NPS scale is **0–10** (industry standard NPS); the `npsScore` column is
  a plain INTEGER and is range-checked at the application layer.
- `npsNote` is **optional** (nullable TEXT).
- Workbook archive is a soft flag (`DiscoveryEvidence.isArchived`) — no
  data is deleted by the close-project wizard.
- `bornFromProject` is a single FK on each side; a project can only have
  one parent project and a retainer can only have one parent project.
  Multi-parent lineage is out of scope for T5.
- The handover doc body is stored as JSONB on `HandoverDoc.content` so
  the structured template (Project Overview, Scope, Decisions Log,
  Workbook Outputs, Training Links) can evolve without schema changes.

## Rollback

```sql
DROP TABLE IF EXISTS "HandoverDoc";
ALTER TABLE "Retainer"
  DROP CONSTRAINT IF EXISTS "Retainer_bornFromProjectId_fkey",
  DROP COLUMN IF EXISTS "bornFromProjectId";
ALTER TABLE "Project"
  DROP CONSTRAINT IF EXISTS "Project_bornFromProjectId_fkey",
  DROP COLUMN IF EXISTS "bornFromProjectId",
  DROP COLUMN IF EXISTS "completedAt",
  DROP COLUMN IF EXISTS "npsCapturedAt",
  DROP COLUMN IF EXISTS "npsNote",
  DROP COLUMN IF EXISTS "npsScore";
ALTER TABLE "DiscoveryEvidence" DROP COLUMN IF EXISTS "isArchived";
ALTER TABLE "Task"
  DROP COLUMN IF EXISTS "sourceWorkstreamItemId",
  DROP COLUMN IF EXISTS "hubspotTicketId";
```

No data loss risk: every column is additive and either nullable or has a
`false`/`NULL` default.
