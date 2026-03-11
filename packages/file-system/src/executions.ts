import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  executionJobRecordSchema,
  type ExecutionJobRecord,
  type ExecutionStep,
  type ModuleExecutionContractDefinition,
  type ModuleExecutionResult
} from "@muloo/shared";

function getExecutionsDirectory(cwd: string): string {
  return path.resolve(cwd, "data", "executions");
}

function getExecutionFilePath(cwd: string, executionId: string): string {
  return path.join(getExecutionsDirectory(cwd), `${executionId}.json`);
}

async function saveExecutionRecord(
  cwd: string,
  record: ExecutionJobRecord
): Promise<ExecutionJobRecord> {
  const directory = getExecutionsDirectory(cwd);
  await fs.mkdir(directory, { recursive: true });
  const filePath = getExecutionFilePath(cwd, record.id);
  await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function createExecutionTimeline(
  jobId: string,
  contract: ModuleExecutionContractDefinition
): ExecutionStep[] {
  return contract.executionSteps.map((step, index) => ({
    id: `${jobId}:${step.key}`,
    jobId,
    key: step.key,
    label: step.label,
    type: step.type,
    order: index,
    status: "queued",
    warnings: [],
    errors: []
  }));
}

function updateTimelineStep(
  steps: ExecutionStep[],
  stepKey: string,
  update: Partial<ExecutionStep>
): ExecutionStep[] {
  return steps.map((step) =>
    step.key === stepKey
      ? {
          ...step,
          ...update,
          warnings: update.warnings ?? step.warnings,
          errors: update.errors ?? step.errors,
          output: update.output ?? step.output
        }
      : step
  );
}

export function markExecutionStepRunning(
  steps: ExecutionStep[],
  stepKey: string,
  summary?: string
): ExecutionStep[] {
  return updateTimelineStep(steps, stepKey, {
    status: "running",
    startedAt: new Date().toISOString(),
    summary
  });
}

export function markExecutionStepSucceeded(
  steps: ExecutionStep[],
  stepKey: string,
  params?: {
    summary?: string;
    warnings?: string[];
    output?: ExecutionStep["output"];
  }
): ExecutionStep[] {
  const current = steps.find((step) => step.key === stepKey);

  return updateTimelineStep(steps, stepKey, {
    status: "succeeded",
    startedAt: current?.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: params?.summary ?? current?.summary,
    warnings: params?.warnings ?? current?.warnings ?? [],
    errors: current?.errors ?? [],
    output: params?.output ?? current?.output
  });
}

export function markExecutionStepFailed(
  steps: ExecutionStep[],
  stepKey: string,
  params: {
    error: string;
    summary?: string;
    output?: ExecutionStep["output"];
  }
): ExecutionStep[] {
  const current = steps.find((step) => step.key === stepKey);

  return updateTimelineStep(steps, stepKey, {
    status: "failed",
    startedAt: current?.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: params.summary ?? current?.summary,
    warnings: current?.warnings ?? [],
    errors: [...(current?.errors ?? []), params.error],
    output: params.output ?? current?.output
  });
}

async function patchExecutionRecord(params: {
  cwd?: string;
  executionId: string;
  status?: ExecutionJobRecord["status"];
  completedAt?: string;
  summaryMetrics?: ExecutionJobRecord["summaryMetrics"];
  warnings?: string[];
  errors?: string[];
  output?: ExecutionJobRecord["output"];
  steps?: ExecutionStep[];
  result?: ModuleExecutionResult;
}): Promise<ExecutionJobRecord> {
  const cwd = params.cwd ?? process.cwd();
  const existing = await loadExecutionById(params.executionId, { cwd });
  const record = executionJobRecordSchema.parse({
    ...existing,
    status: params.status ?? existing.status,
    completedAt: params.completedAt ?? existing.completedAt,
    summaryMetrics: params.summaryMetrics ?? existing.summaryMetrics,
    warnings: params.warnings ?? existing.warnings,
    errors: params.errors ?? existing.errors,
    output: {
      ...existing.output,
      ...params.output
    },
    steps: params.steps ?? existing.steps,
    result: params.result ?? existing.result
  });

  return saveExecutionRecord(cwd, record);
}

export async function loadAllExecutionRecords(options?: {
  cwd?: string;
}): Promise<ExecutionJobRecord[]> {
  const cwd = options?.cwd ?? process.cwd();
  const directory = getExecutionsDirectory(cwd);

  try {
    const entries = await fs.readdir(directory);
    const files = entries
      .filter((entry) => entry.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right));

    const records = await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(path.join(directory, file), "utf8");
        return executionJobRecordSchema.parse(JSON.parse(content));
      })
    );

    return records.sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function loadExecutionById(
  executionId: string,
  options?: { cwd?: string }
): Promise<ExecutionJobRecord> {
  const cwd = options?.cwd ?? process.cwd();
  const filePath = getExecutionFilePath(cwd, executionId);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return executionJobRecordSchema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Execution '${executionId}' was not found.`);
    }

    throw error;
  }
}

export async function loadExecutionSteps(
  executionId: string,
  options?: { cwd?: string }
): Promise<ExecutionStep[]> {
  const execution = await loadExecutionById(executionId, options);
  return execution.steps;
}

export async function loadProjectExecutions(
  projectId: string,
  options?: { cwd?: string }
): Promise<ExecutionJobRecord[]> {
  const records = await loadAllExecutionRecords(options);
  return records.filter((record) => record.projectId === projectId);
}

export async function createExecutionJobRecord(params: {
  cwd?: string;
  projectId: string;
  moduleKey: string;
  executionType: ExecutionJobRecord["executionType"];
  mode: ExecutionJobRecord["mode"];
  triggeredBy: string;
  environment: string;
  specPath?: string;
  steps?: ExecutionStep[];
}): Promise<ExecutionJobRecord> {
  const cwd = params.cwd ?? process.cwd();
  const record = executionJobRecordSchema.parse({
    id: randomUUID(),
    projectId: params.projectId,
    moduleKey: params.moduleKey,
    executionType: params.executionType,
    status: "running",
    mode: params.mode,
    startedAt: new Date().toISOString(),
    summaryMetrics: {},
    warnings: [],
    errors: [],
    output: {
      specPath: params.specPath
    },
    steps: params.steps ?? [],
    triggeredBy: params.triggeredBy,
    environment: params.environment
  });

  return saveExecutionRecord(cwd, record);
}

export async function replaceExecutionSteps(params: {
  cwd?: string;
  executionId: string;
  steps: ExecutionStep[];
}): Promise<ExecutionJobRecord> {
  return patchExecutionRecord(
    params.cwd
      ? {
          cwd: params.cwd,
          executionId: params.executionId,
          steps: params.steps
        }
      : {
          executionId: params.executionId,
          steps: params.steps
        }
  );
}

export async function completeExecutionJobRecord(params: {
  cwd?: string;
  executionId: string;
  summaryMetrics: ExecutionJobRecord["summaryMetrics"];
  warnings?: string[];
  output?: ExecutionJobRecord["output"];
  steps?: ExecutionStep[];
  result?: ModuleExecutionResult;
}): Promise<ExecutionJobRecord> {
  const payload = {
    ...(params.cwd ? { cwd: params.cwd } : {}),
    executionId: params.executionId,
    status: "succeeded" as const,
    completedAt: new Date().toISOString(),
    summaryMetrics: params.summaryMetrics,
    ...(params.warnings ? { warnings: params.warnings } : {}),
    ...(params.output ? { output: params.output } : {}),
    ...(params.steps ? { steps: params.steps } : {}),
    ...(params.result ? { result: params.result } : {})
  };

  return patchExecutionRecord(payload);
}

export async function failExecutionJobRecord(params: {
  cwd?: string;
  executionId: string;
  errors: string[];
  warnings?: string[];
  output?: ExecutionJobRecord["output"];
  steps?: ExecutionStep[];
  result?: ModuleExecutionResult;
}): Promise<ExecutionJobRecord> {
  const existing = await loadExecutionById(
    params.executionId,
    params.cwd ? { cwd: params.cwd } : undefined
  );

  const payload = {
    ...(params.cwd ? { cwd: params.cwd } : {}),
    executionId: params.executionId,
    status: "failed" as const,
    completedAt: new Date().toISOString(),
    warnings: params.warnings ?? existing.warnings,
    errors: [...existing.errors, ...params.errors],
    ...(params.output ? { output: params.output } : {}),
    ...(params.steps ? { steps: params.steps } : {}),
    ...(params.result ? { result: params.result } : {})
  };

  return patchExecutionRecord(payload);
}
