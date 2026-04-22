ALTER TABLE "Task"
ADD COLUMN "workstreamId" TEXT,
ADD COLUMN "taskOrigin" TEXT NOT NULL DEFAULT 'manual';
