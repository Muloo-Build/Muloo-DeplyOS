-- CreateTable: WorkbookTemplate
CREATE TABLE "WorkbookTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "suggestedProjectType" TEXT,
    "suggestedContributorRole" TEXT,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'internal',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkbookTemplate_category_idx" ON "WorkbookTemplate"("category");
CREATE INDEX "WorkbookTemplate_isArchived_idx" ON "WorkbookTemplate"("isArchived");
CREATE INDEX "WorkbookTemplate_suggestedProjectType_idx" ON "WorkbookTemplate"("suggestedProjectType");

-- CreateTable: WorkbookTemplateSection
CREATE TABLE "WorkbookTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbookTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkbookTemplateSection_templateId_sortOrder_idx" ON "WorkbookTemplateSection"("templateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WorkbookTemplateSection"
  ADD CONSTRAINT "WorkbookTemplateSection_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WorkbookTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WorkbookTemplateQuestion
CREATE TABLE "WorkbookTemplateQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "libraryQuestionId" TEXT,
    "questionText" TEXT NOT NULL,
    "helpText" TEXT,
    "answerType" TEXT NOT NULL DEFAULT 'text',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbookTemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkbookTemplateQuestion_sectionId_sortOrder_idx" ON "WorkbookTemplateQuestion"("sectionId", "sortOrder");
CREATE INDEX "WorkbookTemplateQuestion_libraryQuestionId_idx" ON "WorkbookTemplateQuestion"("libraryQuestionId");

-- AddForeignKey
ALTER TABLE "WorkbookTemplateQuestion"
  ADD CONSTRAINT "WorkbookTemplateQuestion_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "WorkbookTemplateSection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkbookTemplateQuestion"
  ADD CONSTRAINT "WorkbookTemplateQuestion_libraryQuestionId_fkey"
  FOREIGN KEY ("libraryQuestionId") REFERENCES "DiscoveryQuestionLibraryItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: link existing project workbooks (DiscoveryEvidence) back to a template
ALTER TABLE "DiscoveryEvidence" ADD COLUMN "sourceTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "DiscoveryEvidence_sourceTemplateId_idx" ON "DiscoveryEvidence"("sourceTemplateId");

-- AddForeignKey
ALTER TABLE "DiscoveryEvidence"
  ADD CONSTRAINT "DiscoveryEvidence_sourceTemplateId_fkey"
  FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkbookTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
