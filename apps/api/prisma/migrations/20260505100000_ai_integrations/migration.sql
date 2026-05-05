-- AI usage events: one row per model call
CREATE TABLE "AIUsageEvent" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "agentKey" TEXT,
    "workflowKey" TEXT,
    "projectId" TEXT,
    "clientId" TEXT,
    "requestId" TEXT,
    "errored" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageEvent_createdAt_idx" ON "AIUsageEvent"("createdAt");
CREATE INDEX "AIUsageEvent_providerKey_createdAt_idx" ON "AIUsageEvent"("providerKey", "createdAt");
CREATE INDEX "AIUsageEvent_model_createdAt_idx" ON "AIUsageEvent"("model", "createdAt");
CREATE INDEX "AIUsageEvent_agentKey_createdAt_idx" ON "AIUsageEvent"("agentKey", "createdAt");
CREATE INDEX "AIUsageEvent_projectId_createdAt_idx" ON "AIUsageEvent"("projectId", "createdAt");
CREATE INDEX "AIUsageEvent_clientId_createdAt_idx" ON "AIUsageEvent"("clientId", "createdAt");

-- Soft monthly spend budgets per provider (or "*" for total)
CREATE TABLE "WorkspaceAIBudget" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "monthlyCapUsd" DOUBLE PRECISION NOT NULL,
    "alertAt50" BOOLEAN NOT NULL DEFAULT true,
    "alertAt80" BOOLEAN NOT NULL DEFAULT true,
    "alertAt100" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAIBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAIBudget_scope_key" ON "WorkspaceAIBudget"("scope");
