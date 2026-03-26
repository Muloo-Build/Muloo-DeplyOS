ALTER TABLE "Project"
ADD COLUMN "blueprintData" JSONB,
ADD COLUMN "discoveryData" JSONB,
ADD COLUMN "standardsData" JSONB;

ALTER TABLE "Task"
ADD COLUMN "agentModuleKey" TEXT,
ADD COLUMN "executionPayload" JSONB;

ALTER TABLE "ExecutionJob"
ADD COLUMN "coworkSessionId" TEXT,
ADD COLUMN "coworkClaimedAt" TIMESTAMP(3);

CREATE TABLE "TaskApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "TaskApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskApproval_taskId_requestedAt_idx" ON "TaskApproval"("taskId", "requestedAt");
CREATE INDEX "TaskApproval_projectId_requestedAt_idx" ON "TaskApproval"("projectId", "requestedAt");

ALTER TABLE "TaskApproval"
ADD CONSTRAINT "TaskApproval_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskApproval"
ADD CONSTRAINT "TaskApproval_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "projectId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
