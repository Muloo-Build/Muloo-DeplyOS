-- Governance: signed agreements per client
CREATE TABLE "ClientAgreement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "documentUrl" TEXT,
    "documentBody" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerEmail" TEXT,
    "signerTitle" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "acceptanceText" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAgreement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientAgreement_clientId_createdAt_idx" ON "ClientAgreement"("clientId", "createdAt");
CREATE INDEX "ClientAgreement_clientId_type_idx" ON "ClientAgreement"("clientId", "type");
CREATE INDEX "ClientAgreement_clientId_status_idx" ON "ClientAgreement"("clientId", "status");

ALTER TABLE "ClientAgreement"
    ADD CONSTRAINT "ClientAgreement_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Reusable agreement templates (NDA / MSA / DPA / other)
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgreementTemplate_type_idx" ON "AgreementTemplate"("type");

-- Security / InfoSec profile per client (findings stored as JSON)
CREATE TABLE "ClientSecurityProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "notes" TEXT,
    "riskLevel" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "nextReviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSecurityProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientSecurityProfile_clientId_key" ON "ClientSecurityProfile"("clientId");

ALTER TABLE "ClientSecurityProfile"
    ADD CONSTRAINT "ClientSecurityProfile_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
