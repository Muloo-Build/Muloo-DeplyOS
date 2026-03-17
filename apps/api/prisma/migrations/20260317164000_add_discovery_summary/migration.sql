CREATE TABLE "DiscoverySummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "engagementTrack" TEXT NOT NULL,
    "platformFit" TEXT NOT NULL,
    "changeManagementRating" TEXT NOT NULL,
    "dataReadinessRating" TEXT NOT NULL,
    "scopeVolatilityRating" TEXT NOT NULL,
    "missingInformation" TEXT[],
    "keyRisks" TEXT[],
    "recommendedNextQuestions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoverySummary_projectId_key" ON "DiscoverySummary"("projectId");

ALTER TABLE "DiscoverySummary" ADD CONSTRAINT "DiscoverySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
