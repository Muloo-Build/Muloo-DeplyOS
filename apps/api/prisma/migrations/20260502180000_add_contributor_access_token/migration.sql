-- AlterTable: add token-only access columns for contributors who do not have a portal account
ALTER TABLE "ProjectContributor"
ADD COLUMN "accessToken" TEXT,
ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex: enforce token uniqueness and enable fast token lookup
CREATE UNIQUE INDEX "ProjectContributor_accessToken_key" ON "ProjectContributor"("accessToken");
