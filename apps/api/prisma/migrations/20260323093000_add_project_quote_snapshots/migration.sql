-- CreateTable
CREATE TABLE "ProjectQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'shared',
    "currency" TEXT NOT NULL,
    "defaultRate" DOUBLE PRECISION,
    "phaseLines" JSONB NOT NULL,
    "productLines" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "paymentSchedule" JSONB NOT NULL,
    "context" JSONB,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "approvedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuote_projectId_version_key" ON "ProjectQuote"("projectId", "version");

-- CreateIndex
CREATE INDEX "ProjectQuote_projectId_createdAt_idx" ON "ProjectQuote"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
