CREATE TABLE "ProjectContext" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectContext_projectId_contextType_key" ON "ProjectContext"("projectId", "contextType");

CREATE INDEX "ProjectContext_projectId_updatedAt_idx" ON "ProjectContext"("projectId", "updatedAt");

ALTER TABLE "ProjectContext"
ADD CONSTRAINT "ProjectContext_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
