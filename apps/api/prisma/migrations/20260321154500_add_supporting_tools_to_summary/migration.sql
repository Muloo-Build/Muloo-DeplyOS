ALTER TABLE "DiscoverySummary"
ADD COLUMN "supportingTools" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;
