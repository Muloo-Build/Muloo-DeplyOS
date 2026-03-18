-- Alter Project and Task tables
ALTER TABLE "Project" ADD COLUMN "deliveryTemplateId" TEXT;
ALTER TABLE "Task" ADD COLUMN "plannedHours" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN "actualHours" DOUBLE PRECISION;

-- Create delivery templates
CREATE TABLE "DeliveryTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "recommendedHubs" TEXT[],
    "defaultPlannedHours" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "executionType" TEXT NOT NULL DEFAULT 'manual',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "qaRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "assigneeType" TEXT,
    "plannedHours" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTemplateTask_pkey" PRIMARY KEY ("id")
);

-- Create work requests
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "urgency" TEXT,
    "budgetRange" TEXT,
    "portalOrWebsite" TEXT,
    "links" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryTemplate_slug_key" ON "DeliveryTemplate"("slug");
CREATE INDEX "DeliveryTemplateTask_templateId_sortOrder_idx" ON "DeliveryTemplateTask"("templateId", "sortOrder");
CREATE INDEX "WorkRequest_status_createdAt_idx" ON "WorkRequest"("status", "createdAt");
CREATE INDEX "WorkRequest_projectId_createdAt_idx" ON "WorkRequest"("projectId", "createdAt");

ALTER TABLE "Project" ADD CONSTRAINT "Project_deliveryTemplateId_fkey" FOREIGN KEY ("deliveryTemplateId") REFERENCES "DeliveryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryTemplateTask" ADD CONSTRAINT "DeliveryTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DeliveryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
