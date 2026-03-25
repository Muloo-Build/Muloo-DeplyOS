ALTER TABLE "Task"
ADD COLUMN "executionLaneRationale" TEXT,
ADD COLUMN "hubspotTierRequired" TEXT,
ADD COLUMN "coworkBrief" TEXT,
ADD COLUMN "manualInstructions" TEXT,
ADD COLUMN "apiPayload" JSONB,
ADD COLUMN "validationStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "validationEvidence" TEXT,
ADD COLUMN "findingId" TEXT,
ADD COLUMN "recommendationId" TEXT;

CREATE TABLE "PortalSnapshot" (
  "id" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hubTier" TEXT,
  "activeHubs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contactPropertyCount" INTEGER,
  "companyPropertyCount" INTEGER,
  "dealPropertyCount" INTEGER,
  "ticketPropertyCount" INTEGER,
  "customObjectCount" INTEGER,
  "dealPipelineCount" INTEGER,
  "dealStageCount" INTEGER,
  "ticketPipelineCount" INTEGER,
  "activeUserCount" INTEGER,
  "teamCount" INTEGER,
  "activeListCount" INTEGER,
  "rawApiResponses" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quickWin" BOOLEAN NOT NULL DEFAULT false,
  "phaseRecommendation" TEXT NOT NULL DEFAULT 'next',
  "evidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'next',
  "rationale" TEXT NOT NULL,
  "effort" TEXT NOT NULL,
  "impact" TEXT NOT NULL,
  "clientApprovalStatus" TEXT NOT NULL DEFAULT 'pending',
  "linkedFindingIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalSnapshot_portalId_capturedAt_idx"
ON "PortalSnapshot"("portalId", "capturedAt");

CREATE INDEX "Finding_projectId_area_severity_idx"
ON "Finding"("projectId", "area", "severity");

CREATE INDEX "Recommendation_projectId_area_type_idx"
ON "Recommendation"("projectId", "area", "type");

ALTER TABLE "PortalSnapshot"
ADD CONSTRAINT "PortalSnapshot_portalId_fkey"
FOREIGN KEY ("portalId") REFERENCES "HubSpotPortal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Finding"
ADD CONSTRAINT "Finding_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Recommendation"
ADD CONSTRAINT "Recommendation_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
