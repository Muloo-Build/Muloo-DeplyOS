-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('AUDIT', 'IMPLEMENTATION', 'MIGRATION', 'OPTIMISATION', 'GUIDED_DEPLOYMENT');

-- AlterTable
ALTER TABLE "DiscoverySubmission" ADD COLUMN     "sections" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "engagementType" "EngagementType" NOT NULL DEFAULT 'IMPLEMENTATION';

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySubmission_projectId_version_key" ON "DiscoverySubmission"("projectId", "version");
