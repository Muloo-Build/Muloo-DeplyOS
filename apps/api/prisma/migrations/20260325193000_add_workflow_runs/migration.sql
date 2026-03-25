-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "portalId" TEXT,
    "providerKey" TEXT,
    "model" TEXT,
    "routeSource" TEXT,
    "requestText" TEXT,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resultStatus" TEXT,
    "outputLog" TEXT,
    "errorLog" TEXT,
    "payload" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowKey_createdAt_idx" ON "WorkflowRun"("workflowKey", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_projectId_createdAt_idx" ON "WorkflowRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_clientId_createdAt_idx" ON "WorkflowRun"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_portalId_createdAt_idx" ON "WorkflowRun"("portalId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "HubSpotPortal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
