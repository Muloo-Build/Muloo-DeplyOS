-- CreateEnum
CREATE TYPE "RolloverBucketStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "retainerId" TEXT;

-- AlterTable
ALTER TABLE "RetainerPeriod" ADD COLUMN "borrowActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RetainerLedgerEntry" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "billApprovedAt" TIMESTAMP(3),
ADD COLUMN "billApprovedBy" TEXT,
ADD COLUMN "billableHours" DOUBLE PRECISION,
ADD COLUMN "billingOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "RolloverBucket" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "hoursOriginal" DECIMAL(10,2) NOT NULL,
    "hoursRemaining" DECIMAL(10,2) NOT NULL,
    "earnMonth" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "RolloverBucketStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolloverBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_retainerId_idx" ON "Project"("retainerId");

-- CreateIndex
CREATE INDEX "RolloverBucket_retainerId_status_expiresAt_idx" ON "RolloverBucket"("retainerId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "RolloverBucket_expiresAt_status_idx" ON "RolloverBucket"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolloverBucket" ADD CONSTRAINT "RolloverBucket_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
