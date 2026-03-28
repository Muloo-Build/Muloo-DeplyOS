ALTER TABLE "WorkspaceUser"
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WorkspaceUser_passwordResetToken_key"
ON "WorkspaceUser"("passwordResetToken");
