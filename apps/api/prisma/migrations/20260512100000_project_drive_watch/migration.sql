-- Per-project Google Drive changes.watch push-notification channel metadata.
ALTER TABLE "Project"
  ADD COLUMN "googleDriveChannelId" TEXT,
  ADD COLUMN "googleDriveResourceId" TEXT,
  ADD COLUMN "googleDriveStartPageToken" TEXT,
  ADD COLUMN "googleDriveChannelExpiresAt" TIMESTAMP(3);

CREATE INDEX "Project_googleDriveChannelId_idx" ON "Project"("googleDriveChannelId");
