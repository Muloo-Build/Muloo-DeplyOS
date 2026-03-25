ALTER TABLE "ExecutionJob"
ADD COLUMN "jobType" TEXT,
ADD COLUMN "outputSummary" TEXT;

ALTER TABLE "Finding"
ADD COLUMN "source" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "evidence_json" JSONB;

UPDATE "Finding"
SET "evidence_json" = jsonb_build_object('summary', "evidence")
WHERE "evidence" IS NOT NULL;

ALTER TABLE "Finding"
DROP COLUMN "evidence";

ALTER TABLE "Finding"
RENAME COLUMN "evidence_json" TO "evidence";

ALTER TABLE "Recommendation"
ADD COLUMN "findingId" TEXT;

CREATE INDEX "Recommendation_findingId_idx" ON "Recommendation"("findingId");

ALTER TABLE "Recommendation"
ADD CONSTRAINT "Recommendation_findingId_fkey"
FOREIGN KEY ("findingId") REFERENCES "Finding"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
