import { DEFAULT_WORKSPACE_ID } from "@muloo/shared";
import { runMarketingDashboardAgent } from "@muloo/executor";
import { prisma } from "../../prisma";
import { JobPayload, JobResult } from "../jobRouter";

export async function runDashboardBuild(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) {
    throw new Error("portalId required for dashboard_build");
  }

  if (!data.projectId) {
    throw new Error("projectId required for dashboard_build");
  }

  const result = await runMarketingDashboardAgent({
    jobId: data.executionJobId,
    projectId: data.projectId,
    portalId: data.portalId,
    workspaceId: DEFAULT_WORKSPACE_ID,
    prisma,
    ...(data.sessionId ? { sessionId: data.sessionId } : {}),
    dryRun: data.dryRun ?? false,
    ...(typeof data.payload?.dashboardName === "string"
      ? { dashboardName: data.payload.dashboardName }
      : { dashboardName: "Marketing Dashboard" }),
    ...(typeof data.payload?.primaryLeadSourceProperty === "string"
      ? { primaryLeadSourceProperty: data.payload.primaryLeadSourceProperty }
      : {}),
    ...(typeof data.payload?.lastKeyActionProperty === "string"
      ? { lastKeyActionProperty: data.payload.lastKeyActionProperty }
      : {}),
    ...(Array.isArray(data.payload?.sectionsToInclude)
      ? { sectionsToInclude: data.payload.sectionsToInclude as string[] }
      : {})
  });

  return {
    success: result.status !== "error",
    dryRun: data.dryRun ?? false,
    output: result
  };
}
