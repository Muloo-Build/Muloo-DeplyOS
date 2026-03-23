CREATE TABLE "WorkspaceEmailOAuthConnection" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "redirectUri" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenType" TEXT,
    "connectedEmail" TEXT,
    "connectedName" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceEmailOAuthConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceEmailOAuthConnection_providerKey_key" ON "WorkspaceEmailOAuthConnection"("providerKey");
