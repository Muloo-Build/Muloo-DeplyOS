-- AlterTable: add welcome-flow tracking fields
ALTER TABLE "ClientPortalUser"
  ADD COLUMN "firstLoginAt" TIMESTAMP(3),
  ADD COLUMN "welcomeDismissedAt" TIMESTAMP(3);

-- Backfill: pretend existing users already had their first login at account creation
UPDATE "ClientPortalUser"
SET "firstLoginAt" = "createdAt"
WHERE "firstLoginAt" IS NULL;
