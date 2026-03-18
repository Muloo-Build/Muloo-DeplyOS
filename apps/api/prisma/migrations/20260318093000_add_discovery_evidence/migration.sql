-- CreateTable
CREATE TABLE "DiscoveryEvidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryEvidence_projectId_sessionNumber_createdAt_idx" ON "DiscoveryEvidence"("projectId", "sessionNumber", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscoveryEvidence" ADD CONSTRAINT "DiscoveryEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
