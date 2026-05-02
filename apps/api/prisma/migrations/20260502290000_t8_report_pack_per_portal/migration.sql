-- T8 follow-up: re-key ReportInstallation per HubSpot portal so multiple
-- projects sharing one portal observe the same install state. Additive in
-- spirit (no data loss for existing rows: projectId column is preserved
-- as audit-only and made nullable; existing FK swapped to ON DELETE SET NULL).

ALTER TABLE "ReportInstallation"
  DROP CONSTRAINT "ReportInstallation_projectId_fkey";

ALTER TABLE "ReportInstallation"
  ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ReportInstallation"
  ADD CONSTRAINT "ReportInstallation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ReportInstallation_projectId_templateSlug_key";

CREATE UNIQUE INDEX "ReportInstallation_portalId_templateSlug_key"
  ON "ReportInstallation"("portalId", "templateSlug");
