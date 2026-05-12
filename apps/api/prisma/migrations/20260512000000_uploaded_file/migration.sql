-- UploadedFile: persistent project-scoped file uploads on Railway volume
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploaderName" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "checksum" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadedFile_evidenceId_key" ON "UploadedFile"("evidenceId");
CREATE INDEX "UploadedFile_projectId_idx" ON "UploadedFile"("projectId");

ALTER TABLE "UploadedFile"
    ADD CONSTRAINT "UploadedFile_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UploadedFile"
    ADD CONSTRAINT "UploadedFile_evidenceId_fkey"
    FOREIGN KEY ("evidenceId") REFERENCES "DiscoveryEvidence"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
