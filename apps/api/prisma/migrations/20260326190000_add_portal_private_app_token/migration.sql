CREATE TABLE IF NOT EXISTS "PortalSession" (
  "id" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "csrfToken" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "privateAppToken" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "capturedBy" TEXT NOT NULL,
  "valid" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PortalSession"
ADD COLUMN IF NOT EXISTS "privateAppToken" TEXT;

CREATE INDEX IF NOT EXISTS "PortalSession_portalId_valid_idx"
ON "PortalSession"("portalId", "valid");
