-- Add per-route test telemetry to WorkspaceAiRouting
ALTER TABLE "WorkspaceAiRouting"
  ADD COLUMN "lastTestedAt" TIMESTAMP(3),
  ADD COLUMN "lastTestStatus" TEXT,
  ADD COLUMN "lastTestError" TEXT,
  ADD COLUMN "lastTestSampleOutput" TEXT,
  ADD COLUMN "lastTestLatencyMs" INTEGER,
  ADD COLUMN "lastTestCostUsd" DOUBLE PRECISION,
  ADD COLUMN "lastTestModel" TEXT;
