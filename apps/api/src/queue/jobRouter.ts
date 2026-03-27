import { runPortalAudit } from './processors/portalAudit';
import { runPropertyApply } from './processors/propertyApply';
import { runDashboardBuild } from './processors/dashboardBuild';
import { runResearchAgent } from './processors/researchAgent';

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

export async function routeJob(data: JobPayload): Promise<JobResult> {
  switch (data.moduleKey) {
    case 'portal_audit':
      return runPortalAudit(data);
    case 'property_apply':
      return runPropertyApply(data);
    case 'dashboard_build':
      return runDashboardBuild(data);
    case 'research':
      return runResearchAgent(data);
    default:
      throw new Error(`Unknown moduleKey: ${data.moduleKey}`);
  }
}
