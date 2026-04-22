ALTER TABLE "Project"
ADD COLUMN "platformConfiguration" JSONB,
ADD COLUMN "deliveryWorkstreams" JSONB,
ADD COLUMN "internalCommercials" JSONB,
ADD COLUMN "latestClientSubmissionAt" TIMESTAMP(3),
ADD COLUMN "latestClientSubmissionSeenAt" TIMESTAMP(3),
ADD COLUMN "latestClientSubmissionSession" INTEGER,
ADD COLUMN "latestClientSubmissionByName" TEXT;
