-- T8 — HubSpot Standard Report Pack. Additive only.

CREATE TABLE "ReportTemplate" (
  "id"           TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "hub"          TEXT NOT NULL,
  "section"      TEXT NOT NULL,
  "chartType"    TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "spec"         JSONB NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportTemplate_slug_key" ON "ReportTemplate"("slug");
CREATE INDEX "ReportTemplate_hub_displayOrder_idx" ON "ReportTemplate"("hub", "displayOrder");
CREATE INDEX "ReportTemplate_isActive_idx" ON "ReportTemplate"("isActive");

CREATE TABLE "ReportInstallation" (
  "id"                 TEXT NOT NULL,
  "projectId"          TEXT NOT NULL,
  "portalId"           TEXT NOT NULL,
  "templateId"         TEXT NOT NULL,
  "templateSlug"       TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'pending',
  "hubspotReportId"    TEXT,
  "hubspotDashboardId" TEXT,
  "hubspotReportUrl"   TEXT,
  "errorMessage"       TEXT,
  "lastInstalledAt"    TIMESTAMP(3),
  "lastAttemptAt"      TIMESTAMP(3),
  "attemptCount"       INTEGER NOT NULL DEFAULT 0,
  "executionJobId"     TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportInstallation_projectId_templateSlug_key"
  ON "ReportInstallation"("projectId", "templateSlug");
CREATE INDEX "ReportInstallation_portalId_status_idx"
  ON "ReportInstallation"("portalId", "status");
CREATE INDEX "ReportInstallation_projectId_status_idx"
  ON "ReportInstallation"("projectId", "status");
CREATE INDEX "ReportInstallation_templateId_idx"
  ON "ReportInstallation"("templateId");

ALTER TABLE "ReportInstallation"
  ADD CONSTRAINT "ReportInstallation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportInstallation"
  ADD CONSTRAINT "ReportInstallation_portalId_fkey"
  FOREIGN KEY ("portalId") REFERENCES "HubSpotPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportInstallation"
  ADD CONSTRAINT "ReportInstallation_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
