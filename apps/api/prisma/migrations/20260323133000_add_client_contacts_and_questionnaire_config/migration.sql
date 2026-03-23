-- Add client contact records and project-level questionnaire configuration
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "canApproveQuotes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
ADD COLUMN "clientQuestionnaireConfig" JSONB;

CREATE UNIQUE INDEX "ClientContact_clientId_email_key" ON "ClientContact"("clientId", "email");
CREATE INDEX "ClientContact_clientId_createdAt_idx" ON "ClientContact"("clientId", "createdAt");

ALTER TABLE "ClientContact"
ADD CONSTRAINT "ClientContact_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
