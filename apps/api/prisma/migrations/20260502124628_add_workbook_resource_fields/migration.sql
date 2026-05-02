-- AlterTable
ALTER TABLE "DiscoveryEvidence" ADD COLUMN     "assignedContributorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ownerContributorId" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "workbookContent" JSONB;

-- CreateIndex
CREATE INDEX "DiscoveryEvidence_projectId_resourceType_idx" ON "DiscoveryEvidence"("projectId", "resourceType");
