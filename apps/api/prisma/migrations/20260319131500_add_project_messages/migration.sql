CREATE TABLE "ProjectMessage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "internalSeenAt" TIMESTAMP(3),
  "clientSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectMessage_projectId_createdAt_idx" ON "ProjectMessage"("projectId", "createdAt");

ALTER TABLE "ProjectMessage"
ADD CONSTRAINT "ProjectMessage_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
