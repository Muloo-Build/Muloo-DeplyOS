CREATE TABLE "WorkspaceAiRouting" (
  "id" TEXT NOT NULL,
  "workflowKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "modelOverride" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceAiRouting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAiRouting_workflowKey_key"
ON "WorkspaceAiRouting"("workflowKey");
