-- Public workbook share links (Typeform-style).
-- Additive: new optional columns on DiscoveryEvidence and a new
-- WorkbookPublicSubmission table for incoming public submissions
-- pending operator review.

ALTER TABLE "DiscoveryEvidence"
  ADD COLUMN "publicShareToken"     TEXT,
  ADD COLUMN "publicShareEnabled"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicShareExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DiscoveryEvidence_publicShareToken_key"
  ON "DiscoveryEvidence"("publicShareToken");

CREATE TABLE "WorkbookPublicSubmission" (
  "id"               TEXT        NOT NULL,
  "workbookId"       TEXT        NOT NULL,
  "projectId"        TEXT        NOT NULL,
  "firstName"        TEXT        NOT NULL,
  "lastName"         TEXT        NOT NULL,
  "email"            TEXT        NOT NULL,
  "organisation"     TEXT,
  "responses"        JSONB       NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'pending_review',
  "reviewerNotes"    TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkbookPublicSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkbookPublicSubmission_projectId_createdAt_idx"
  ON "WorkbookPublicSubmission"("projectId", "createdAt");
CREATE INDEX "WorkbookPublicSubmission_workbookId_createdAt_idx"
  ON "WorkbookPublicSubmission"("workbookId", "createdAt");
CREATE INDEX "WorkbookPublicSubmission_status_idx"
  ON "WorkbookPublicSubmission"("status");

ALTER TABLE "WorkbookPublicSubmission"
  ADD CONSTRAINT "WorkbookPublicSubmission_workbookId_fkey"
  FOREIGN KEY ("workbookId") REFERENCES "DiscoveryEvidence"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkbookPublicSubmission"
  ADD CONSTRAINT "WorkbookPublicSubmission_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
