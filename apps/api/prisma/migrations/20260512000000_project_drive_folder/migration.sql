-- Per-project Google Drive folder linking + auto-sync metadata.
ALTER TABLE "Project"
  ADD COLUMN "googleDriveFolderId" TEXT,
  ADD COLUMN "googleDriveFolderUrl" TEXT,
  ADD COLUMN "googleDriveLastSyncedAt" TIMESTAMP(3);

CREATE INDEX "Project_googleDriveFolderId_idx" ON "Project"("googleDriveFolderId");
