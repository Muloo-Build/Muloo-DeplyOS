-- AlterTable: Project ownership/billing display fields
ALTER TABLE "Project"
  ADD COLUMN "billingOwner" TEXT,
  ADD COLUMN "deliveryOwner" TEXT,
  ADD COLUMN "partnerName" TEXT;

-- AlterTable: WorkRequest change-log enhancements
ALTER TABLE "WorkRequest"
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "impactedWorkstreamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable: DiscoveryEvidence workbook discriminator + metadata
ALTER TABLE "DiscoveryEvidence"
  ADD COLUMN "kind" TEXT,
  ADD COLUMN "workstreamId" TEXT,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "sharedWith" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "linkedSectionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "DiscoveryEvidence_projectId_kind_idx" ON "DiscoveryEvidence"("projectId", "kind");

-- CreateTable: ProjectContributor
CREATE TABLE "ProjectContributor" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'contributor',
  "portalUserId" TEXT,
  "relatedWorkbookIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relatedQuestionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectContributor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectContributor_projectId_contactId_key" ON "ProjectContributor"("projectId", "contactId");
CREATE INDEX "ProjectContributor_projectId_createdAt_idx" ON "ProjectContributor"("projectId", "createdAt");
CREATE INDEX "ProjectContributor_contactId_idx" ON "ProjectContributor"("contactId");

ALTER TABLE "ProjectContributor"
  ADD CONSTRAINT "ProjectContributor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContributor_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
