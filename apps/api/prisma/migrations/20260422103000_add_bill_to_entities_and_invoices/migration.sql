-- CreateEnum
CREATE TYPE "BillToEntityType" AS ENUM ('CLIENT', 'PARTNER_AGENCY');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RETAINER_BLOCK', 'TOP_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- AlterTable
ALTER TABLE "Retainer" ADD COLUMN "billToEntityId" TEXT;

-- CreateTable
CREATE TABLE "BillToEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BillToEntityType" NOT NULL,
    "clientId" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillToEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "billToEntityId" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "retainerPeriodId" TEXT,
    "invoiceType" "InvoiceType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "RetainerCurrency" NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "xeroUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Backfill bill-to entities for existing retainers
INSERT INTO "BillToEntity" (
    "id",
    "name",
    "type",
    "clientId",
    "createdAt",
    "updatedAt"
)
SELECT
    'bte_' || md5("Client"."id" || clock_timestamp()::text),
    "Client"."name",
    'CLIENT'::"BillToEntityType",
    "Client"."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Client"
WHERE EXISTS (
    SELECT 1
    FROM "Retainer"
    WHERE "Retainer"."clientId" = "Client"."id"
);

UPDATE "Retainer"
SET "billToEntityId" = "BillToEntity"."id"
FROM "BillToEntity"
WHERE "BillToEntity"."clientId" = "Retainer"."clientId"
  AND "BillToEntity"."type" = 'CLIENT';

-- AlterTable
ALTER TABLE "Retainer" ALTER COLUMN "billToEntityId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "BillToEntity_clientId_idx" ON "BillToEntity"("clientId");

-- CreateIndex
CREATE INDEX "BillToEntity_type_name_idx" ON "BillToEntity"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_reference_key" ON "Invoice"("reference");

-- CreateIndex
CREATE INDEX "Invoice_billToEntityId_status_idx" ON "Invoice"("billToEntityId", "status");

-- CreateIndex
CREATE INDEX "Invoice_retainerId_issueDate_idx" ON "Invoice"("retainerId", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_retainerPeriodId_idx" ON "Invoice"("retainerPeriodId");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Retainer_billToEntityId_idx" ON "Retainer"("billToEntityId");

-- AddForeignKey
ALTER TABLE "BillToEntity" ADD CONSTRAINT "BillToEntity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_billToEntityId_fkey" FOREIGN KEY ("billToEntityId") REFERENCES "BillToEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billToEntityId_fkey" FOREIGN KEY ("billToEntityId") REFERENCES "BillToEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_retainerPeriodId_fkey" FOREIGN KEY ("retainerPeriodId") REFERENCES "RetainerPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
