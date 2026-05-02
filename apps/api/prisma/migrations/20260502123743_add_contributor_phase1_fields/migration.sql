-- AlterTable
ALTER TABLE "ProjectContributor" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN     "canSubmitWorkbookResponses" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdByContributorId" TEXT,
ADD COLUMN     "createdByType" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "organisation" TEXT,
ADD COLUMN     "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stakeholderType" TEXT;
