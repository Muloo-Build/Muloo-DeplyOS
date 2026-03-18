ALTER TABLE "Project"
ADD COLUMN "commercialBrief" TEXT;

CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "approvalMode" TEXT NOT NULL DEFAULT 'review_required',
    "allowedActions" TEXT[],
    "systemPrompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDefinition_slug_key" ON "AgentDefinition"("slug");
