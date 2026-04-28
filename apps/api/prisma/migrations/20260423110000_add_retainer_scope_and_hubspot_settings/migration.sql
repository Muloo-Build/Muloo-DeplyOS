-- Retainer scope, deliverables, approval terms, requirements
ALTER TABLE "Retainer"
ADD COLUMN "scopeSummary" TEXT,
ADD COLUMN "deliverables" JSONB,
ADD COLUMN "approvalTerms" TEXT,
ADD COLUMN "requirements" TEXT;

-- Workspace-level HubSpot settings (singleton: id defaults to 'default')
CREATE TABLE "WorkspaceHubSpotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "partnerInviteUrl" TEXT,
    "partnerAccountId" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceHubSpotSettings_pkey" PRIMARY KEY ("id")
);
