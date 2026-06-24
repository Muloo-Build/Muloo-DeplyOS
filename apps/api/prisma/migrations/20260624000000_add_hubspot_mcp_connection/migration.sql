-- CreateTable
CREATE TABLE "HubSpotMcpConnection" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "displayName" TEXT,
    "hubDomain" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenType" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedEmail" TEXT,
    "connectedName" TEXT,
    "installedAt" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubSpotMcpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubSpotMcpConnection_portalId_key" ON "HubSpotMcpConnection"("portalId");
