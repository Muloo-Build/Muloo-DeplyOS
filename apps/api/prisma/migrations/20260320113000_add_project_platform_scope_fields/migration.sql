ALTER TABLE "Project"
ADD COLUMN "customerPlatformTier" TEXT,
ADD COLUMN "platformTierSelections" JSONB,
ADD COLUMN "problemStatement" TEXT,
ADD COLUMN "solutionRecommendation" TEXT,
ADD COLUMN "scopeExecutiveSummary" TEXT;
