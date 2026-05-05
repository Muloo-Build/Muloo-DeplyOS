import { calculateCostUsd } from "@muloo/shared";

import { prisma } from "./prisma";

export interface UsageInputTokens {
  promptTokens?: number | null | undefined;
  completionTokens?: number | null | undefined;
  totalTokens?: number | null | undefined;
}

export interface LogAIUsageInput {
  providerKey: string;
  model: string;
  tokens: UsageInputTokens;
  latencyMs?: number | null;
  agentKey?: string | null;
  workflowKey?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  requestId?: string | null;
  errored?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

function safeInt(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

// Fire-and-forget. Never throw to caller — usage logging must not break model calls.
export function logAIUsageEvent(input: LogAIUsageInput): void {
  const promptTokens = safeInt(input.tokens.promptTokens);
  const completionTokens = safeInt(input.tokens.completionTokens);
  const totalTokens =
    safeInt(input.tokens.totalTokens) || promptTokens + completionTokens;

  const { inputCostUsd, outputCostUsd, totalCostUsd } = calculateCostUsd(
    input.providerKey,
    input.model,
    promptTokens,
    completionTokens
  );

  void prisma.aIUsageEvent
    .create({
      data: {
        providerKey: input.providerKey,
        model: input.model,
        promptTokens,
        completionTokens,
        totalTokens,
        inputCostUsd,
        outputCostUsd,
        totalCostUsd,
        latencyMs: input.latencyMs ?? null,
        agentKey: input.agentKey ?? null,
        workflowKey: input.workflowKey ?? null,
        projectId: input.projectId ?? null,
        clientId: input.clientId ?? null,
        requestId: input.requestId ?? null,
        errored: input.errored ?? false,
        errorMessage: input.errorMessage ?? null,
        metadata: (input.metadata ?? null) as never
      }
    })
    .catch((error) => {
      console.warn("[ai-usage] failed to write event", error);
    });
}

// Extracts {prompt_tokens, completion_tokens} from common provider response shapes.
export function extractUsage(payload: unknown): UsageInputTokens {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  const usage =
    (obj.usage as Record<string, unknown> | undefined) ??
    ((obj.usageMetadata as Record<string, unknown> | undefined) ?? undefined);
  if (!usage) return {};

  // Anthropic: input_tokens / output_tokens
  // OpenAI / Perplexity / Mistral / Grok / DeepSeek: prompt_tokens / completion_tokens / total_tokens
  // Gemini: promptTokenCount / candidatesTokenCount / totalTokenCount
  const promptTokens =
    (usage.prompt_tokens as number | undefined) ??
    (usage.input_tokens as number | undefined) ??
    (usage.promptTokenCount as number | undefined);
  const completionTokens =
    (usage.completion_tokens as number | undefined) ??
    (usage.output_tokens as number | undefined) ??
    (usage.candidatesTokenCount as number | undefined);
  const totalTokens =
    (usage.total_tokens as number | undefined) ??
    (usage.totalTokenCount as number | undefined);

  return { promptTokens, completionTokens, totalTokens };
}

export interface SpendSummaryInput {
  fromDate?: Date;
  toDate?: Date;
  groupBy?: "provider" | "model" | "agent" | "project" | "client";
}

export interface SpendBucket {
  key: string;
  label: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  erroredCount: number;
}

export interface SpendSummary {
  fromDate: string;
  toDate: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  erroredCount: number;
  byProvider: SpendBucket[];
  byModel: SpendBucket[];
  byAgent: SpendBucket[];
  byProject: SpendBucket[];
  daily: { date: string; totalCostUsd: number; totalTokens: number; callCount: number }[];
}

function rangeFromInput(input: SpendSummaryInput): { fromDate: Date; toDate: Date } {
  const toDate = input.toDate ?? new Date();
  const fromDate =
    input.fromDate ??
    new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

export async function loadSpendSummary(
  input: SpendSummaryInput = {}
): Promise<SpendSummary> {
  const { fromDate, toDate } = rangeFromInput(input);

  const events = await prisma.aIUsageEvent.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    select: {
      providerKey: true,
      model: true,
      agentKey: true,
      workflowKey: true,
      projectId: true,
      clientId: true,
      totalCostUsd: true,
      totalTokens: true,
      errored: true,
      createdAt: true
    }
  });

  let totalCostUsd = 0;
  let totalTokens = 0;
  let erroredCount = 0;

  const providerMap = new Map<string, SpendBucket>();
  const modelMap = new Map<string, SpendBucket>();
  const agentMap = new Map<string, SpendBucket>();
  const projectMap = new Map<string, SpendBucket>();
  const dailyMap = new Map<
    string,
    { date: string; totalCostUsd: number; totalTokens: number; callCount: number }
  >();

  function bumpBucket(map: Map<string, SpendBucket>, key: string, label: string, ev: typeof events[number]) {
    const existing = map.get(key) ?? {
      key,
      label,
      totalCostUsd: 0,
      totalTokens: 0,
      callCount: 0,
      erroredCount: 0
    };
    existing.totalCostUsd += ev.totalCostUsd;
    existing.totalTokens += ev.totalTokens;
    existing.callCount += 1;
    if (ev.errored) existing.erroredCount += 1;
    map.set(key, existing);
  }

  for (const event of events) {
    totalCostUsd += event.totalCostUsd;
    totalTokens += event.totalTokens;
    if (event.errored) erroredCount += 1;

    bumpBucket(providerMap, event.providerKey, event.providerKey, event);
    bumpBucket(modelMap, event.model, event.model, event);
    if (event.agentKey) {
      bumpBucket(agentMap, event.agentKey, event.agentKey, event);
    }
    if (event.projectId) {
      bumpBucket(projectMap, event.projectId, event.projectId, event);
    }

    const dateKey = event.createdAt.toISOString().slice(0, 10);
    const dailyExisting = dailyMap.get(dateKey) ?? {
      date: dateKey,
      totalCostUsd: 0,
      totalTokens: 0,
      callCount: 0
    };
    dailyExisting.totalCostUsd += event.totalCostUsd;
    dailyExisting.totalTokens += event.totalTokens;
    dailyExisting.callCount += 1;
    dailyMap.set(dateKey, dailyExisting);
  }

  function sortBuckets(map: Map<string, SpendBucket>): SpendBucket[] {
    return Array.from(map.values()).sort(
      (a, b) => b.totalCostUsd - a.totalCostUsd
    );
  }

  return {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    totalCostUsd,
    totalTokens,
    callCount: events.length,
    erroredCount,
    byProvider: sortBuckets(providerMap),
    byModel: sortBuckets(modelMap),
    byAgent: sortBuckets(agentMap),
    byProject: sortBuckets(projectMap),
    daily: Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  };
}

export interface BudgetState {
  scope: string;
  monthlyCapUsd: number;
  spentUsd: number;
  percent: number;
  alertAt50: boolean;
  alertAt80: boolean;
  alertAt100: boolean;
  alertedThresholds: number[];
  notes: string | null;
}

export async function loadBudgetStates(): Promise<BudgetState[]> {
  const budgets = await prisma.workspaceAIBudget.findMany();
  if (budgets.length === 0) return [];

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const events = await prisma.aIUsageEvent.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { providerKey: true, totalCostUsd: true }
  });

  let allSpend = 0;
  const byProvider = new Map<string, number>();
  for (const event of events) {
    allSpend += event.totalCostUsd;
    byProvider.set(
      event.providerKey,
      (byProvider.get(event.providerKey) ?? 0) + event.totalCostUsd
    );
  }

  return budgets.map((budget) => {
    const spentUsd =
      budget.scope === "*"
        ? allSpend
        : byProvider.get(budget.scope) ?? 0;
    const percent =
      budget.monthlyCapUsd > 0 ? (spentUsd / budget.monthlyCapUsd) * 100 : 0;
    const alertedThresholds: number[] = [];
    if (budget.alertAt50 && percent >= 50) alertedThresholds.push(50);
    if (budget.alertAt80 && percent >= 80) alertedThresholds.push(80);
    if (budget.alertAt100 && percent >= 100) alertedThresholds.push(100);
    return {
      scope: budget.scope,
      monthlyCapUsd: budget.monthlyCapUsd,
      spentUsd,
      percent,
      alertAt50: budget.alertAt50,
      alertAt80: budget.alertAt80,
      alertAt100: budget.alertAt100,
      alertedThresholds,
      notes: budget.notes
    };
  });
}

export async function upsertBudget(input: {
  scope: string;
  monthlyCapUsd: number;
  alertAt50?: boolean | undefined;
  alertAt80?: boolean | undefined;
  alertAt100?: boolean | undefined;
  notes?: string | null | undefined;
}) {
  const scope = input.scope.trim();
  if (!scope) throw new Error("scope is required");
  if (!Number.isFinite(input.monthlyCapUsd) || input.monthlyCapUsd <= 0) {
    throw new Error("monthlyCapUsd must be a positive number");
  }
  const updateData: Record<string, unknown> = {
    monthlyCapUsd: input.monthlyCapUsd
  };
  if (typeof input.alertAt50 === "boolean") updateData.alertAt50 = input.alertAt50;
  if (typeof input.alertAt80 === "boolean") updateData.alertAt80 = input.alertAt80;
  if (typeof input.alertAt100 === "boolean") updateData.alertAt100 = input.alertAt100;
  if (input.notes !== undefined) updateData.notes = input.notes;

  return prisma.workspaceAIBudget.upsert({
    where: { scope },
    create: {
      scope,
      monthlyCapUsd: input.monthlyCapUsd,
      alertAt50: input.alertAt50 ?? true,
      alertAt80: input.alertAt80 ?? true,
      alertAt100: input.alertAt100 ?? true,
      notes: input.notes ?? null
    },
    update: updateData
  });
}

export async function deleteBudget(scope: string) {
  return prisma.workspaceAIBudget.delete({ where: { scope } });
}
