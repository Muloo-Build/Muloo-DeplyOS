import { BrowserSessionExecutor } from "@muloo/browser-session-executor";
import { Prisma } from "@prisma/client";
import {
  TemplateEngine,
  type ReportTemplate,
  type TemplateConfig
} from "@muloo/report-templates";
import type { CoworkInstruction } from "@muloo/shared";
import { prisma } from "../../prisma";
import { JobPayload, JobResult } from "../jobRouter";

interface DashboardBuildFailure {
  templateId: string;
  name: string;
  error: string;
}

interface DashboardBuildOutput {
  status: "complete" | "partial" | "queued_for_cowork";
  summary: string;
  dashboardId?: string;
  dashboardUrl?: string;
  reportIds?: string[];
  templateIds?: string[];
  failures?: DashboardBuildFailure[];
  executionTier?: 2 | 3;
  coworkInstruction?: CoworkInstruction;
}

function buildCoworkInstruction(
  portalId: string,
  dashboardName: string,
  templateIds: string[]
): CoworkInstruction {
  return {
    id: `cowork-dashboard-build-${portalId}-${Date.now()}`,
    taskType: "hubspot_dashboard_create",
    portalId,
    targetUrl: `https://app-eu1.hubspot.com/reports/${encodeURIComponent(portalId)}`,
    steps: [
      {
        order: 1,
        action: "navigate",
        target: "HubSpot reporting workspace",
        description: "Open the target portal reporting area."
      },
      {
        order: 2,
        action: "verify",
        target: "Browser session connection",
        description:
          "Confirm a fresh PortalSession exists with a valid browser-authenticated CSRF token."
      },
      {
        order: 3,
        action: "click",
        target: "Create dashboard",
        description: `Build ${dashboardName} using templates: ${templateIds.join(", ")}`
      }
    ],
    expectedOutcome: `${dashboardName} is created in HubSpot with the requested reports.`,
    fallbackToManual: []
  };
}

function extractIdentifier(data: unknown, candidateKeys: string[]) {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractDashboardUrl(data: unknown, portalId: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidate =
      typeof record.dashboardUrl === "string"
        ? record.dashboardUrl
        : typeof record.url === "string"
          ? record.url
          : null;

    if (candidate?.trim()) {
      return candidate.trim();
    }
  }

  return `https://app-eu1.hubspot.com/reports/${encodeURIComponent(portalId)}`;
}

function resolveTemplates(
  engine: TemplateEngine,
  payload: Record<string, unknown> | undefined
): ReportTemplate[] {
  const templateId =
    typeof payload?.templateId === "string" ? payload.templateId.trim() : "";

  if (templateId) {
    const template = engine.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return [template];
  }

  const sectionFilter = new Set(
    Array.isArray(payload?.sectionsToInclude)
      ? payload.sectionsToInclude
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  );

  return engine
    .getAllTemplates()
    .filter((template) =>
      sectionFilter.size > 0 ? sectionFilter.has(template.section) : true
    );
}

export async function runDashboardBuild(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) {
    throw new Error("portalId required for dashboard_build");
  }

  const portalSession = data.sessionId
    ? await prisma.portalSession.findUnique({
        where: { id: data.sessionId }
      })
    : await prisma.portalSession.findFirst({
        where: { portalId: data.portalId, valid: true },
        orderBy: { capturedAt: "desc" }
      });

  const payload = data.payload;
  const dashboardName =
    typeof payload?.dashboardName === "string" && payload.dashboardName.trim()
      ? payload.dashboardName.trim()
      : "Marketing Dashboard";
  const engine = new TemplateEngine();
  const templates = resolveTemplates(engine, payload);

  if (!portalSession?.csrfToken?.trim()) {
    const output: DashboardBuildOutput = {
      status: "queued_for_cowork",
      summary:
        "Portal session missing. Dashboard build queued for cowork follow-up.",
      executionTier: 3,
      coworkInstruction: buildCoworkInstruction(
        data.portalId,
        dashboardName,
        templates.map((template) => template.id)
      )
    };

    await prisma.executionJob.update({
      where: { id: data.executionJobId },
      data: {
        outputSummary: output.summary,
        executionTier: 3,
        coworkInstruction: output.coworkInstruction as Prisma.InputJsonValue
      }
    });

    return {
      success: true,
      dryRun: data.dryRun ?? false,
      output
    };
  }

  const executor = new BrowserSessionExecutor({
    portalId: data.portalId,
    csrfToken: portalSession.csrfToken,
    baseUrl: portalSession.baseUrl
  });
  const templateConfig: TemplateConfig = {
    portalId: data.portalId,
    ...(typeof payload?.primaryLeadSourceProperty === "string"
      ? { primaryLeadSourceProperty: payload.primaryLeadSourceProperty }
      : {}),
    ...(typeof payload?.lastKeyActionProperty === "string"
      ? { lastKeyActionProperty: payload.lastKeyActionProperty }
      : {})
  };
  const reportIds: string[] = [];
  const failures: DashboardBuildFailure[] = [];

  for (const template of templates) {
    try {
      const reportDefinition = template.build(templateConfig);
      const createResult = await executor.createReport(reportDefinition);

      if (!createResult.success) {
        failures.push({
          templateId: template.id,
          name: template.name,
          error: createResult.error ?? "Failed to create report"
        });
        continue;
      }

      const reportId = extractIdentifier(createResult.data, ["reportId", "id"]);
      if (!reportId) {
        failures.push({
          templateId: template.id,
          name: template.name,
          error: "Report created but no report ID was returned"
        });
        continue;
      }

      reportIds.push(reportId);
    } catch (error) {
      failures.push({
        templateId: template.id,
        name: template.name,
        error:
          error instanceof Error ? error.message : "Failed to build report"
      });
    }
  }

  if (reportIds.length === 0) {
    const output: DashboardBuildOutput = {
      status: "partial",
      summary: "Dashboard build could not create any reports.",
      templateIds: templates.map((template) => template.id),
      failures,
      executionTier: 2
    };

    await prisma.executionJob.update({
      where: { id: data.executionJobId },
      data: {
        outputSummary: output.summary,
        executionTier: 2
      }
    });

    return {
      success: true,
      dryRun: data.dryRun ?? false,
      output
    };
  }

  const dashboardResult = await executor.createDashboard({
    name: dashboardName,
    portalId: data.portalId
  });

  if (!dashboardResult.success) {
    const output: DashboardBuildOutput = {
      status: "partial",
      summary: `Created ${reportIds.length} report(s), but dashboard creation failed.`,
      reportIds,
      templateIds: templates.map((template) => template.id),
      failures: [
        ...failures,
        {
          templateId: "dashboard",
          name: dashboardName,
          error: dashboardResult.error ?? "Dashboard creation failed"
        }
      ],
      executionTier: 2
    };

    await prisma.executionJob.update({
      where: { id: data.executionJobId },
      data: {
        outputSummary: output.summary,
        executionTier: 2
      }
    });

    return {
      success: true,
      dryRun: data.dryRun ?? false,
      output
    };
  }

  const dashboardId = extractIdentifier(dashboardResult.data, [
    "dashboardId",
    "id"
  ]);

  if (dashboardId) {
    for (const reportId of reportIds) {
      const attachResult = await executor.addReportToDashboard(
        dashboardId,
        reportId
      );

      if (!attachResult.success) {
        failures.push({
          templateId: "dashboard_attach",
          name: reportId,
          error:
            attachResult.error ??
            `Failed to attach report ${reportId} to the dashboard`
        });
      }
    }
  } else {
    failures.push({
      templateId: "dashboard",
      name: dashboardName,
      error: "Dashboard created but no dashboard ID was returned"
    });
  }

  const output: DashboardBuildOutput = {
    status: failures.length > 0 ? "partial" : "complete",
    summary:
      failures.length > 0
        ? `Created ${reportIds.length} report(s) with ${failures.length} follow-up issue(s).`
        : `Created ${reportIds.length} report(s) and assembled ${dashboardName}.`,
    ...(dashboardId ? { dashboardId } : {}),
    dashboardUrl: extractDashboardUrl(dashboardResult.data, data.portalId),
    reportIds,
    templateIds: templates.map((template) => template.id),
    failures,
    executionTier: 2
  };

  await prisma.executionJob.update({
    where: { id: data.executionJobId },
    data: {
      outputSummary: output.summary,
      executionTier: 2
    }
  });

  return {
    success: true,
    dryRun: data.dryRun ?? false,
    output
  };
}
