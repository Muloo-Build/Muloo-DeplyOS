-- Recovered: applied directly to production on 28 March 2026, never committed
ALTER TABLE "WorkspaceUser" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "WorkspaceUser" ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "WorkspaceUser_passwordResetToken_key" ON "WorkspaceUser"("passwordResetToken");
