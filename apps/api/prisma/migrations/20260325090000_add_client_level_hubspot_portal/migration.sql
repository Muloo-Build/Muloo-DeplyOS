ALTER TABLE "Client"
ADD COLUMN "hubSpotPortalId" TEXT;

UPDATE "Client" AS client
SET "hubSpotPortalId" = source."portalId"
FROM (
  SELECT DISTINCT ON ("clientId")
    "clientId",
    "portalId"
  FROM "Project"
  ORDER BY "clientId", "updatedAt" DESC, "createdAt" DESC
) AS source
WHERE client."id" = source."clientId";

UPDATE "Project" AS project
SET "portalId" = client."hubSpotPortalId"
FROM "Client" AS client
WHERE project."clientId" = client."id"
  AND client."hubSpotPortalId" IS NOT NULL
  AND project."portalId" <> client."hubSpotPortalId";

CREATE INDEX "Client_hubSpotPortalId_idx" ON "Client"("hubSpotPortalId");

ALTER TABLE "Client"
ADD CONSTRAINT "Client_hubSpotPortalId_fkey"
FOREIGN KEY ("hubSpotPortalId") REFERENCES "HubSpotPortal"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
