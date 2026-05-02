-- CreateTable
CREATE TABLE "DiscoveryQuestionLibraryItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "questionText" TEXT NOT NULL,
    "helpText" TEXT,
    "answerType" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedStakeholderType" TEXT,
    "defaultRequired" BOOLEAN NOT NULL DEFAULT false,
    "linkedHubSpotArea" TEXT,
    "linkedWebsiteArea" TEXT,
    "complexityLevel" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryQuestionLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryQuestionLibraryItem_category_idx" ON "DiscoveryQuestionLibraryItem"("category");

-- CreateIndex
CREATE INDEX "DiscoveryQuestionLibraryItem_linkedHubSpotArea_idx" ON "DiscoveryQuestionLibraryItem"("linkedHubSpotArea");

-- CreateIndex
CREATE INDEX "DiscoveryQuestionLibraryItem_linkedWebsiteArea_idx" ON "DiscoveryQuestionLibraryItem"("linkedWebsiteArea");

-- CreateIndex
CREATE INDEX "DiscoveryQuestionLibraryItem_recommendedStakeholderType_idx" ON "DiscoveryQuestionLibraryItem"("recommendedStakeholderType");
