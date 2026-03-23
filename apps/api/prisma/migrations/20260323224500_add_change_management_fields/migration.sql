ALTER TABLE "WorkRequest"
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "commercialImpactHours" DOUBLE PRECISION,
ADD COLUMN "commercialImpactFeeZar" DOUBLE PRECISION,
ADD COLUMN "deliveryTasks" JSONB,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedByName" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "deliveryAppendedAt" TIMESTAMP(3);

ALTER TABLE "Task"
ADD COLUMN "changeRequestId" TEXT,
ADD COLUMN "scopeOrigin" TEXT NOT NULL DEFAULT 'baseline';

ALTER TABLE "Task"
ADD CONSTRAINT "Task_changeRequestId_fkey"
FOREIGN KEY ("changeRequestId") REFERENCES "WorkRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
