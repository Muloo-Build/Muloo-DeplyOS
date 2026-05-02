-- AlterTable
ALTER TABLE "ClientContact" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "ClientContactNote" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContactNote_contactId_createdAt_idx" ON "ClientContactNote"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientContactNote" ADD CONSTRAINT "ClientContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
