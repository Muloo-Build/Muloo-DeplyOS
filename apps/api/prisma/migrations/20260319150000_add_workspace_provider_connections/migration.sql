CREATE TABLE "WorkspaceProviderConnection" (
  "id" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "connectionType" TEXT NOT NULL,
  "apiKey" TEXT,
  "defaultModel" TEXT,
  "endpointUrl" TEXT,
  "notes" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceProviderConnection_providerKey_key"
ON "WorkspaceProviderConnection"("providerKey");
