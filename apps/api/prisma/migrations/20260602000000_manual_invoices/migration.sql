-- Manual invoices: make retainerId optional, add clientId/championContactId/origin,
-- add InvoiceOrigin enum, add InvoiceLineItem table.
-- Existing retainer-driven invoices get origin='RETAINER' via column default.

-- CreateEnum
CREATE TYPE "InvoiceOrigin" AS ENUM ('RETAINER', 'MANUAL');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "championContactId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "origin" "InvoiceOrigin" NOT NULL DEFAULT 'RETAINER',
ALTER COLUMN "retainerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_sortOrder_idx" ON "InvoiceLineItem"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "Invoice_clientId_issueDate_idx" ON "Invoice"("clientId", "issueDate");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_championContactId_fkey" FOREIGN KEY ("championContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
