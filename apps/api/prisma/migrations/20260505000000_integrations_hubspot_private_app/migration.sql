-- Workspace-level HubSpot private app (singleton)
CREATE TABLE "WorkspaceHubSpotPrivateApp" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "label" TEXT NOT NULL DEFAULT 'Muloo HubSpot',
    "portalId" TEXT,
    "hubDomain" TEXT,
    "encryptedToken" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectedEmail" TEXT,
    "connectedName" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceHubSpotPrivateApp_pkey" PRIMARY KEY ("id")
);

-- Tracks imported HubSpot companies → Muloo Clients
CREATE TABLE "HubSpotImportedCompany" (
    "id" TEXT NOT NULL,
    "hubspotCompanyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "domain" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "syncDirection" TEXT,
    "notes" TEXT,

    CONSTRAINT "HubSpotImportedCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubSpotImportedCompany_hubspotCompanyId_key" ON "HubSpotImportedCompany"("hubspotCompanyId");
CREATE UNIQUE INDEX "HubSpotImportedCompany_clientId_key" ON "HubSpotImportedCompany"("clientId");
CREATE INDEX "HubSpotImportedCompany_clientId_idx" ON "HubSpotImportedCompany"("clientId");
