ALTER TABLE "DiscoverySummary"
ADD COLUMN "inScopeItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "outOfScopeItems" TEXT[] DEFAULT ARRAY[]::TEXT[];
