export interface JobPayload {
  executionJobId: string;
  moduleKey: string;
  projectId?: string;
  portalId?: string;
  sessionId?: string;
  dryRun?: boolean;
  payload?: Record<string, unknown>;
  providerKey?: string;
  modelId?: string;
}

export interface JobResult {
  success: boolean;
  dryRun: boolean;
  output: unknown;
}
