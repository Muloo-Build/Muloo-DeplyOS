CREATE TABLE "WorkspaceApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default',
    "keyName" TEXT NOT NULL,
    "keyValue" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceApiKey_workspaceId_keyName_key" ON "WorkspaceApiKey"("workspaceId", "keyName");

CREATE INDEX "WorkspaceApiKey_workspaceId_updatedAt_idx" ON "WorkspaceApiKey"("workspaceId", "updatedAt");
