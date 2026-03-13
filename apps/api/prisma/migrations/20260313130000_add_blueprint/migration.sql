-- DropForeignKey
ALTER TABLE "Deliverable" DROP CONSTRAINT "Deliverable_blueprintId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_deliverableId_fkey";

-- AlterTable
ALTER TABLE "Blueprint"
DROP COLUMN "appliedModules",
DROP COLUMN "approvalStatus",
DROP COLUMN "architectureSummary",
DROP COLUMN "createdAt",
DROP COLUMN "deliverablesJson",
DROP COLUMN "discoveryVersion",
DROP COLUMN "riskFlags",
DROP COLUMN "updatedAt",
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "deliverableId";

-- DropTable
DROP TABLE "Deliverable";

-- CreateTable
CREATE TABLE "BlueprintTask" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "effortHours" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "BlueprintTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlueprintTask_blueprintId_phase_order_idx" ON "BlueprintTask"("blueprintId", "phase", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Blueprint_projectId_key" ON "Blueprint"("projectId");

-- AddForeignKey
ALTER TABLE "BlueprintTask" ADD CONSTRAINT "BlueprintTask_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
