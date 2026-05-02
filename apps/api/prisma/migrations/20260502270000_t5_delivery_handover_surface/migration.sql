-- T5 — Delivery + handover surface (additive migration)
--
-- Adds the schema needed for the four T5 sub-steps:
--   T5.1  Task gains hubspotTicketId + sourceWorkstreamItemId so we can
--         link tickets and idempotently seed tasks from workstreams.
--   T5.2  HandoverDoc — one structured handover doc per project.
--   T5.3  Project gains npsScore / npsNote / npsCapturedAt / completedAt;
--         DiscoveryEvidence gains isArchived so the close-project wizard
--         can archive workbooks without deleting them.
--   T5.4  Project.bornFromProjectId (self-FK) and Retainer.bornFromProjectId
--         carry the lineage forward when a project spawns a retainer or a
--         retainer spawns a follow-on project.
--
-- All operations are additive. Rollback = drop the new columns, indexes,
-- constraints, and the HandoverDoc table.

-- ---------- T5.1: Task ----------
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "hubspotTicketId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sourceWorkstreamItemId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_hubspotTicketId_idx"
  ON "Task" ("hubspotTicketId");
CREATE INDEX IF NOT EXISTS "Task_sourceWorkstreamItemId_idx"
  ON "Task" ("sourceWorkstreamItemId");

-- ---------- T5.3: Project NPS + completion + DiscoveryEvidence archive ----------
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "npsScore" INTEGER;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "npsNote" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "npsCapturedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "DiscoveryEvidence"
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "DiscoveryEvidence_projectId_isArchived_idx"
  ON "DiscoveryEvidence" ("projectId", "isArchived");

-- ---------- T5.4: bornFromProject lineage ----------
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "bornFromProjectId" TEXT;
CREATE INDEX IF NOT EXISTS "Project_bornFromProjectId_idx"
  ON "Project" ("bornFromProjectId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_bornFromProjectId_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_bornFromProjectId_fkey"
      FOREIGN KEY ("bornFromProjectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

ALTER TABLE "Retainer" ADD COLUMN IF NOT EXISTS "bornFromProjectId" TEXT;
CREATE INDEX IF NOT EXISTS "Retainer_bornFromProjectId_idx"
  ON "Retainer" ("bornFromProjectId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Retainer_bornFromProjectId_fkey'
  ) THEN
    ALTER TABLE "Retainer"
      ADD CONSTRAINT "Retainer_bornFromProjectId_fkey"
      FOREIGN KEY ("bornFromProjectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ---------- T5.2: HandoverDoc ----------
CREATE TABLE IF NOT EXISTS "HandoverDoc" (
  "id"               TEXT NOT NULL,
  "projectId"        TEXT NOT NULL,
  "content"          JSONB NOT NULL,
  "generatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sharedToPortalAt" TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HandoverDoc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HandoverDoc_projectId_key"
  ON "HandoverDoc" ("projectId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HandoverDoc_projectId_fkey'
  ) THEN
    ALTER TABLE "HandoverDoc"
      ADD CONSTRAINT "HandoverDoc_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
