-- Delivery Ops Pack: TimeEntry, ProjectRisk, meeting intelligence fields

-- TimeEntry
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "occurredOn" DATE NOT NULL,
    "notes" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeEntry_projectId_occurredOn_idx" ON "TimeEntry"("projectId", "occurredOn");
CREATE INDEX "TimeEntry_userEmail_occurredOn_idx" ON "TimeEntry"("userEmail", "occurredOn");
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProjectRisk (RAID: risk | issue | decision | assumption)
CREATE TABLE "ProjectRisk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'risk',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "mitigation" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectRisk_projectId_status_idx" ON "ProjectRisk"("projectId", "status");
CREATE INDEX "ProjectRisk_projectId_kind_idx" ON "ProjectRisk"("projectId", "kind");

ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meeting intelligence on existing notes
ALTER TABLE "ProjectMeetingNote" ADD COLUMN "extractedActions" JSONB;
ALTER TABLE "ProjectMeetingNote" ADD COLUMN "extractedDecisions" JSONB;
ALTER TABLE "ProjectMeetingNote" ADD COLUMN "extractedRisks" JSONB;
ALTER TABLE "ProjectMeetingNote" ADD COLUMN "extractedAt" TIMESTAMP(3);
