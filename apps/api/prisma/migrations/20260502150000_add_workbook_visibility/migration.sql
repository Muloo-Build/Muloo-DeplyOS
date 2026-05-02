-- Add visibility field to DiscoveryEvidence
ALTER TABLE "DiscoveryEvidence" ADD COLUMN "visibility" TEXT;

-- Default all existing workbooks to "internal" so nothing leaks to client portal
UPDATE "DiscoveryEvidence" SET "visibility" = 'internal' WHERE "kind" = 'workbook';
