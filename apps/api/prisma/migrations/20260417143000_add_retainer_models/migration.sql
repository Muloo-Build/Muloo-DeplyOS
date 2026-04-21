-- CreateEnum
CREATE TYPE "RetainerServiceLine" AS ENUM ('TECHNICAL_DELIVERY', 'CONSULTING');

-- CreateEnum
CREATE TYPE "RetainerCurrency" AS ENUM ('ZAR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD');

-- CreateEnum
CREATE TYPE "RetainerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "RetainerPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RetainerLedgerEntryType" AS ENUM ('TASK_CONSUMPTION', 'TOP_UP', 'MANUAL_ADJUSTMENT', 'MONTH_RECONCILIATION');

-- CreateEnum
CREATE TYPE "RetainerProducedBy" AS ENUM ('HUMAN', 'AGENT', 'HYBRID');

-- CreateEnum
CREATE TYPE "RetainerTopUpStatus" AS ENUM ('QUOTED', 'APPROVED', 'INVOICED');

-- CreateTable
CREATE TABLE "Retainer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceLine" "RetainerServiceLine" NOT NULL,
    "blockSize" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "currency" "RetainerCurrency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "RetainerStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerPeriod" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "blockHours" INTEGER NOT NULL,
    "rolledInHours" INTEGER NOT NULL DEFAULT 0,
    "borrowedFromNext" INTEGER NOT NULL DEFAULT 0,
    "consumedHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overageHours" INTEGER NOT NULL DEFAULT 0,
    "rolledOutHours" INTEGER NOT NULL DEFAULT 0,
    "status" "RetainerPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetainerPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerLedgerEntry" (
    "id" TEXT NOT NULL,
    "retainerPeriodId" TEXT NOT NULL,
    "taskId" TEXT,
    "entryType" "RetainerLedgerEntryType" NOT NULL,
    "hoursDelta" DECIMAL(10,2) NOT NULL,
    "plannedHours" DECIMAL(10,2),
    "billedHours" DECIMAL(10,2),
    "producedBy" "RetainerProducedBy",
    "overrideReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainerTopUp" (
    "id" TEXT NOT NULL,
    "retainerPeriodId" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "status" "RetainerTopUpStatus" NOT NULL DEFAULT 'QUOTED',
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "approvedByClientUserId" TEXT,

    CONSTRAINT "RetainerTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Retainer_clientId_status_idx" ON "Retainer"("clientId", "status");

-- CreateIndex
CREATE INDEX "Retainer_serviceLine_status_idx" ON "Retainer"("serviceLine", "status");

-- CreateIndex
CREATE INDEX "Retainer_startDate_idx" ON "Retainer"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "RetainerPeriod_retainerId_periodMonth_key" ON "RetainerPeriod"("retainerId", "periodMonth");

-- CreateIndex
CREATE INDEX "RetainerPeriod_periodMonth_status_idx" ON "RetainerPeriod"("periodMonth", "status");

-- CreateIndex
CREATE INDEX "RetainerLedgerEntry_retainerPeriodId_createdAt_idx" ON "RetainerLedgerEntry"("retainerPeriodId", "createdAt");

-- CreateIndex
CREATE INDEX "RetainerLedgerEntry_taskId_idx" ON "RetainerLedgerEntry"("taskId");

-- CreateIndex
CREATE INDEX "RetainerLedgerEntry_entryType_createdAt_idx" ON "RetainerLedgerEntry"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX "RetainerTopUp_retainerPeriodId_status_idx" ON "RetainerTopUp"("retainerPeriodId", "status");

-- CreateIndex
CREATE INDEX "RetainerTopUp_approvedByClientUserId_idx" ON "RetainerTopUp"("approvedByClientUserId");

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerPeriod" ADD CONSTRAINT "RetainerPeriod_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerLedgerEntry" ADD CONSTRAINT "RetainerLedgerEntry_retainerPeriodId_fkey" FOREIGN KEY ("retainerPeriodId") REFERENCES "RetainerPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerLedgerEntry" ADD CONSTRAINT "RetainerLedgerEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerTopUp" ADD CONSTRAINT "RetainerTopUp_retainerPeriodId_fkey" FOREIGN KEY ("retainerPeriodId") REFERENCES "RetainerPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerTopUp" ADD CONSTRAINT "RetainerTopUp_approvedByClientUserId_fkey" FOREIGN KEY ("approvedByClientUserId") REFERENCES "ClientPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
