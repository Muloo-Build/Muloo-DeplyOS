-- AlterTable
ALTER TABLE "ClientPortalUser"
ADD COLUMN "inviteAcceptedAt" TIMESTAMP(3),
ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalUser_inviteToken_key" ON "ClientPortalUser"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalUser_passwordResetToken_key" ON "ClientPortalUser"("passwordResetToken");
