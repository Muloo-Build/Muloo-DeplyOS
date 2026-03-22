ALTER TABLE "Project"
ADD COLUMN "quoteApprovalStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN "quoteSharedAt" TIMESTAMP(3),
ADD COLUMN "quoteApprovedAt" TIMESTAMP(3),
ADD COLUMN "quoteApprovedByName" TEXT,
ADD COLUMN "quoteApprovedByEmail" TEXT,
ADD COLUMN "scopeLockedAt" TIMESTAMP(3);
