-- T3 Step A — Discovery model unification (additive only)
--
-- Adds the columns needed to absorb ClientInputSubmission into
-- DiscoverySubmission, plus a one-off data migration that re-categorises
-- DiscoveryQuestionLibraryItem rows from the legacy 13-category set onto
-- the canonical 12-category set.
--
-- Step B (drop ClientInputSubmission entirely) is a follow-up; do NOT add
-- destructive operations here. See RUNBOOK.md.

-- 1) Additive columns on the canonical model
ALTER TABLE "DiscoverySubmission"
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "sessionNumber" INTEGER,
    ADD COLUMN IF NOT EXISTS "answers" JSONB,
    ADD COLUMN IF NOT EXISTS "legacyClientInputSubmissionId" TEXT;

CREATE INDEX IF NOT EXISTS "DiscoverySubmission_projectId_userId_sessionNumber_idx"
    ON "DiscoverySubmission"("projectId", "userId", "sessionNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "DiscoverySubmission_legacyClientInputSubmissionId_key"
    ON "DiscoverySubmission"("legacyClientInputSubmissionId")
    WHERE "legacyClientInputSubmissionId" IS NOT NULL;

-- 2) Backfill from ClientInputSubmission. At time of writing this is a
--    no-op (0 rows in production-equivalent) but the SQL runs idempotently
--    so re-applying the migration on a populated environment behaves the
--    same way: each ClientInputSubmission becomes a DiscoverySubmission
--    row keyed by (projectId, userId, sessionNumber). The version column
--    on DiscoverySubmission already has a default of 1; we leave it alone
--    when backfilling so the existing (projectId, version) unique is not
--    violated by colliding session-numbered rows.
INSERT INTO "DiscoverySubmission" (
    "id",
    "projectId",
    "version",
    "status",
    "userId",
    "sessionNumber",
    "answers",
    "legacyClientInputSubmissionId",
    "createdAt",
    "updatedAt"
)
SELECT
    'cis_' || cis."id",
    cis."projectId",
    1000000 + cis."sessionNumber",  -- offset away from real version sequence
    cis."status",
    cis."userId",
    cis."sessionNumber",
    cis."answers",
    cis."id",
    cis."createdAt",
    cis."updatedAt"
FROM "ClientInputSubmission" cis
WHERE NOT EXISTS (
    SELECT 1
    FROM "DiscoverySubmission" ds
    WHERE ds."legacyClientInputSubmissionId" = cis."id"
)
ON CONFLICT DO NOTHING;

-- 3) Re-categorise DiscoveryQuestionLibraryItem rows from the legacy
--    snake_case category set to the canonical 12-category list. This is
--    a one-off data migration; running it again is a no-op because the
--    UPDATE only touches rows still using the legacy values.
UPDATE "DiscoveryQuestionLibraryItem"
SET "category" = CASE "category"
    WHEN 'sales_process'         THEN 'CRM and Sales'
    WHEN 'website_content'       THEN 'Website and CMS'
    WHEN 'website_architecture'  THEN 'Website and CMS'
    WHEN 'marketing_content'     THEN 'Marketing'
    WHEN 'data_migration'        THEN 'Data and Migration'
    WHEN 'integrations'          THEN 'Integrations'
    WHEN 'service_support'       THEN 'Service and Support'
    WHEN 'tech_stack'            THEN 'Integrations'
    WHEN 'brand_positioning'     THEN 'Business Goals'
    WHEN 'reporting_analytics'   THEN 'Reporting'
    WHEN 'goals_success'         THEN 'Business Goals'
    WHEN 'operational_pain'      THEN 'Operations'
    WHEN 'compliance_governance' THEN 'Security and Access'
    ELSE "category"
END
WHERE "category" IN (
    'sales_process',
    'website_content',
    'website_architecture',
    'marketing_content',
    'data_migration',
    'integrations',
    'service_support',
    'tech_stack',
    'brand_positioning',
    'reporting_analytics',
    'goals_success',
    'operational_pain',
    'compliance_governance'
);
