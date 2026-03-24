ALTER TABLE "Client"
ADD COLUMN "clientRoles" TEXT[] NOT NULL DEFAULT ARRAY['client']::TEXT[],
ADD COLUMN "parentClientId" TEXT,
ADD COLUMN "enrichedLogoUrl" TEXT,
ADD COLUMN "companyOverview" TEXT,
ADD COLUMN "lastEnrichedAt" TIMESTAMP(3);

CREATE TABLE "PartnerClientVisibility" (
  "id" TEXT NOT NULL,
  "partnerClientId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "visibilityScope" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerClientVisibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerClientVisibility_partnerClientId_clientId_key"
ON "PartnerClientVisibility"("partnerClientId", "clientId");

CREATE INDEX "PartnerClientVisibility_partnerClientId_idx"
ON "PartnerClientVisibility"("partnerClientId");

CREATE INDEX "PartnerClientVisibility_clientId_idx"
ON "PartnerClientVisibility"("clientId");

ALTER TABLE "Client"
ADD CONSTRAINT "Client_parentClientId_fkey"
FOREIGN KEY ("parentClientId") REFERENCES "Client"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "PartnerClientVisibility"
ADD CONSTRAINT "PartnerClientVisibility_partnerClientId_fkey"
FOREIGN KEY ("partnerClientId") REFERENCES "Client"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PartnerClientVisibility"
ADD CONSTRAINT "PartnerClientVisibility_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
