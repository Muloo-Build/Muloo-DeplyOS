ALTER TABLE "HubSpotPortal"
ADD COLUMN "refreshToken" TEXT,
ADD COLUMN "tokenType" TEXT,
ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "connectedEmail" TEXT,
ADD COLUMN "connectedName" TEXT,
ADD COLUMN "hubDomain" TEXT,
ADD COLUMN "installedAt" TIMESTAMP(3);
