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

-- Deduplicate before re-keying. Under the prior schema, two projects on the
-- same HubSpot portal could each have a ReportInstallation row for the same
-- templateSlug. The new (portalId, templateSlug) unique index would fail to
-- build on those rows, so we collapse duplicates first.
--
-- Strategy: per (portalId, templateSlug) group, keep the row that best
-- represents current state — prefer status='installed' (most recent
-- lastInstalledAt), then status='failed' (most recent lastAttemptAt), then
-- the most recently updated row of any other status. The surviving row
-- inherits the latest install metadata so operators don't lose history,
-- and its projectId is rewritten to the surviving row's own projectId
-- (so the audit reference is internally consistent — no cross-row mixing).
WITH ranked AS (
  SELECT
    "id",
    "portalId",
    "templateSlug",
    ROW_NUMBER() OVER (
      PARTITION BY "portalId", "templateSlug"
      ORDER BY
        CASE WHEN "status" = 'installed' THEN 0
             WHEN "status" = 'failed'    THEN 1
             ELSE 2 END,
        COALESCE("lastInstalledAt", "lastAttemptAt", "updatedAt") DESC,
        "updatedAt" DESC,
        "id" DESC
    ) AS rn
  FROM "ReportInstallation"
),
winners AS (
  SELECT
    ri."portalId",
    ri."templateSlug",
    -- Roll the latest install metadata across the whole group onto the
    -- surviving row so we don't lose evidence of a successful prior install.
    MAX(ri."hubspotReportId") FILTER (WHERE ri."status" = 'installed') AS best_hubspot_report_id,
    MAX(ri."hubspotReportUrl") FILTER (WHERE ri."status" = 'installed') AS best_hubspot_report_url,
    MAX(ri."lastInstalledAt") AS best_last_installed_at,
    MAX(ri."lastAttemptAt")   AS best_last_attempt_at,
    SUM(COALESCE(ri."attemptCount", 0))::int AS total_attempts
  FROM "ReportInstallation" ri
  GROUP BY ri."portalId", ri."templateSlug"
)
UPDATE "ReportInstallation" target
SET
  "hubspotReportId"  = COALESCE(target."hubspotReportId",  winners.best_hubspot_report_id),
  "hubspotReportUrl" = COALESCE(target."hubspotReportUrl", winners.best_hubspot_report_url),
  "lastInstalledAt"  = GREATEST(COALESCE(target."lastInstalledAt", winners.best_last_installed_at), winners.best_last_installed_at),
  "lastAttemptAt"    = GREATEST(COALESCE(target."lastAttemptAt",   winners.best_last_attempt_at),   winners.best_last_attempt_at),
  "attemptCount"     = winners.total_attempts
FROM ranked, winners
WHERE target."id" = ranked."id"
  AND ranked.rn = 1
  AND winners."portalId"     = target."portalId"
  AND winners."templateSlug" = target."templateSlug";

DELETE FROM "ReportInstallation" ri
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "portalId", "templateSlug"
        ORDER BY
          CASE WHEN "status" = 'installed' THEN 0
               WHEN "status" = 'failed'    THEN 1
               ELSE 2 END,
          COALESCE("lastInstalledAt", "lastAttemptAt", "updatedAt") DESC,
          "updatedAt" DESC,
          "id" DESC
      ) AS rn
    FROM "ReportInstallation"
  ) r
  WHERE r."id" = ri."id" AND r.rn > 1
);

CREATE UNIQUE INDEX "ReportInstallation_portalId_templateSlug_key"
  ON "ReportInstallation"("portalId", "templateSlug");
