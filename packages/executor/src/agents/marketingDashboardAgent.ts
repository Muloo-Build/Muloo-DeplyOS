import type { PrismaClient } from "@prisma/client";
import { BrowserSessionExecutor } from "@muloo/browser-session-executor";
import { createLogger } from "@muloo/core";
import { HubSpotClient } from "@muloo/hubspot-client";
import type { CoworkInstruction } from "@muloo/shared";
import { getApiKey } from "@muloo/shared";
import {
  TemplateEngine,
  type DashboardSection,
  type ReportDefinition,
  type ReportTemplate,
  type TemplateConfig
} from "@muloo/report-templates";

interface MarketingDashboardInput {
  jobId: string;
  projectId: string;
  portalId: string;
  workspaceId: string;
  prisma: PrismaClient;
  sessionId?: string;
  dashboardName?: string;
  primaryLeadSourceProperty?: string;
  lastKeyActionProperty?: string;
  sectionsToInclude?: string[];
  dryRun?: boolean;
}

interface ReportCreationResult {
  templateId: string;
  reportId?: string;
  name: string;
  section: DashboardSection;
  executionTier: 2 | 4;
  status: "created" | "planned" | "skipped" | "failed";
  error?: string;
}

interface TemplateAuditResult {
  templateId: string;
  buildable: boolean;
  missingProps: string[];
}

export interface MarketingDashboardOutput {
  status: "complete" | "partial" | "plan_only" | "error" | "queued_for_cowork";
  dashboardUrl?: string;
  dashboardId?: string;
  reportsCreated: ReportCreationResult[];
  manualSteps: CoworkInstruction[];
  summary: string;
  audits: TemplateAuditResult[];
  executionTier: 2 | 4;
  coworkInstruction?: CoworkInstruction;
}

async function updateJobSummary(
  prisma: PrismaClient,
  jobId: string,
  outputSummary: string
) {
  await prisma.executionJob.update({
    where: { id: jobId },
    data: {
      outputSummary,
      startedAt: new Date()
    }
  });
}

async function getValidPortalSession(
  prisma: PrismaClient,
  portalId: string,
  sessionId?: string
) {
  if (sessionId) {
    const session = await prisma.portalSession.findUnique({
      where: { id: sessionId }
    });

    if (session && session.valid && session.portalId === portalId) {
      return session;
    }
  }

  return prisma.portalSession.findFirst({
    where: { portalId, valid: true },
    orderBy: { capturedAt: "desc" }
  });
}

function buildCoworkInstruction(input: {
  portalId: string;
  dashboardName: string;
  templateIds: string[];
  reason: string;
}): CoworkInstruction {
  return {
    id: `cowork-dashboard-${Date.now()}`,
    taskType: "hubspot_dashboard_create",
    portalId: input.portalId,
    targetUrl: `https://app-eu1.hubspot.com/reports/${encodeURIComponent(
      input.portalId
    )}`,
    steps: [
      {
        order: 1,
        action: "navigate",
        target: "HubSpot reporting workspace",
        description: "Open the reporting area for the target portal."
      },
      {
        order: 2,
        action: "click",
        target: "Create report",
        description: `Create reports for: ${input.templateIds.join(", ")}`
      },
      {
        order: 3,
        action: "fill_field",
        target: "Dashboard name",
        value: input.dashboardName,
        description: "Use the requested dashboard name."
      },
      {
        order: 4,
        action: "verify",
        target: "Completed dashboard",
        description: input.reason
      }
    ],
    expectedOutcome: `Dashboard ${input.dashboardName} created with ${input.templateIds.length} report(s).`,
    fallbackToManual: []
  };
}

function buildManualInstructionForTemplate(input: {
  portalId: string;
  template: ReportTemplate;
  reason: string;
}): CoworkInstruction {
  return {
    id: `cowork-template-${input.template.id}-${Date.now()}`,
    taskType: "hubspot_report_create",
    portalId: input.portalId,
    targetUrl: `https://app-eu1.hubspot.com/reports/${encodeURIComponent(
      input.portalId
    )}`,
    steps: [
      {
        order: 1,
        action: "navigate",
        target: "HubSpot reporting workspace",
        description: "Open the report builder."
      },
      {
        order: 2,
        action: "verify",
        target: input.template.name,
        description: input.reason
      }
    ],
    expectedOutcome: `${input.template.name} is created or the blocker is documented.`,
    fallbackToManual: []
  };
}

async function propertyExists(input: {
  hubspotClient: HubSpotClient | null;
  executor: BrowserSessionExecutor | null;
  propertyName: string;
}) {
  if (input.hubspotClient) {
    return Boolean(
      await input.hubspotClient.getPropertyByName("contacts", input.propertyName)
    );
  }

  if (input.executor) {
    const result = await input.executor.getContactProperty(input.propertyName);
    return result.success && Boolean(result.data);
  }

  throw new Error("No HubSpot audit client available");
}

function extractIdentifier(
  data: unknown,
  candidateKeys: string[]
): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (
      value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).id === "string"
    ) {
      return ((value as Record<string, unknown>).id as string).trim();
    }
  }

  return undefined;
}

function extractUrl(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as Record<string, unknown>;
  const candidate =
    typeof record.url === "string"
      ? record.url
      : typeof record.dashboardUrl === "string"
        ? record.dashboardUrl
        : typeof record.reportUrl === "string"
          ? record.reportUrl
          : null;

  return candidate?.trim() || fallback;
}

export async function runMarketingDashboardAgent(
  input: MarketingDashboardInput
): Promise<MarketingDashboardOutput> {
  const logger = createLogger({ service: "marketing-dashboard-agent" });
  const engine = new TemplateEngine();
  const dryRun = input.dryRun ?? false;
  const dashboardName = input.dashboardName?.trim() || "Marketing Dashboard";
  const sectionFilter = new Set(
    (input.sectionsToInclude ?? []).map((value) => value.trim()).filter(Boolean)
  );
  const templates = engine
    .getAllTemplates()
    .filter((template) =>
      sectionFilter.size > 0 ? sectionFilter.has(template.section) : true
    );
  const accessToken = await getApiKey(input.workspaceId, "hubspot", input.prisma);
  const hubspotClient = accessToken
    ? new HubSpotClient({ accessToken, logger })
    : null;
  const session = await getValidPortalSession(
    input.prisma,
    input.portalId,
    input.sessionId
  );
  const executor = session
    ? new BrowserSessionExecutor({
        portalId: input.portalId,
        csrfToken: session.csrfToken,
        baseUrl: session.baseUrl
      })
    : null;
  const executionTier: 2 | 4 = executor ? 2 : 4;

  await updateJobSummary(input.prisma, input.jobId, "Auditing report templates");

  const audits: TemplateAuditResult[] = [];
  const reportsCreated: ReportCreationResult[] = [];
  const manualSteps: CoworkInstruction[] = [];
  const plannedReports = new Map<
    string,
    { template: ReportTemplate; definition: ReportDefinition }
  >();
  const templateConfig: TemplateConfig = {
    portalId: input.portalId,
    ...(input.primaryLeadSourceProperty
      ? { primaryLeadSourceProperty: input.primaryLeadSourceProperty }
      : {}),
    ...(input.lastKeyActionProperty
      ? { lastKeyActionProperty: input.lastKeyActionProperty }
      : {})
  };

  for (const template of templates) {
    const missingProps: string[] = [];

    for (const propertyName of template.requiredProperties) {
      const exists = await propertyExists({
        hubspotClient,
        executor,
        propertyName
      });

      if (!exists) {
        missingProps.push(propertyName);
      }
    }

    const buildable = missingProps.length === 0;
    audits.push({
      templateId: template.id,
      buildable,
      missingProps
    });

    if (!buildable) {
      reportsCreated.push({
        templateId: template.id,
        name: template.name,
        section: template.section,
        executionTier,
        status: "skipped",
        error: `Missing properties: ${missingProps.join(", ")}`
      });
      manualSteps.push(
        buildManualInstructionForTemplate({
          portalId: input.portalId,
          template,
          reason: `Create or map these properties first: ${missingProps.join(", ")}`
        })
      );
      continue;
    }

    try {
      plannedReports.set(template.id, {
        template,
        definition: template.build(templateConfig)
      });
      reportsCreated.push({
        templateId: template.id,
        name: template.name,
        section: template.section,
        executionTier,
        status: dryRun ? "planned" : "skipped"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to build report plan";
      reportsCreated.push({
        templateId: template.id,
        name: template.name,
        section: template.section,
        executionTier,
        status: "failed",
        error: message
      });
      manualSteps.push(
        buildManualInstructionForTemplate({
          portalId: input.portalId,
          template,
          reason: message
        })
      );
    }
  }

  const plannedTemplateIds = Array.from(plannedReports.keys());
  const plannedCount = plannedTemplateIds.length;

  if (dryRun) {
    return {
      status: "plan_only",
      reportsCreated,
      manualSteps,
      audits,
      executionTier,
      summary: `Planned ${plannedCount} report(s) for ${dashboardName}.`
    };
  }

  if (!executor) {
    const coworkInstruction = buildCoworkInstruction({
      portalId: input.portalId,
      dashboardName,
      templateIds: plannedTemplateIds,
      reason:
        "No valid browser session is available for direct HubSpot report creation."
    });

    return {
      status: "queued_for_cowork",
      reportsCreated,
      manualSteps,
      audits,
      executionTier,
      coworkInstruction,
      summary: `Queued cowork follow-up for ${plannedCount} report(s).`
    };
  }

  await updateJobSummary(input.prisma, input.jobId, "Creating HubSpot reports");

  for (const [templateId, plannedReport] of plannedReports.entries()) {
    const result = await executor.createReport(plannedReport.definition);

    if (!result.success) {
      const failureMessage = result.error ?? "Report creation failed";
      const currentReport = reportsCreated.find(
        (report) => report.templateId === templateId
      );

      if (currentReport) {
        currentReport.status = "failed";
        currentReport.error = failureMessage;
      }

      manualSteps.push(
        buildManualInstructionForTemplate({
          portalId: input.portalId,
          template: plannedReport.template,
          reason: failureMessage
        })
      );
      continue;
    }

    const reportId = extractIdentifier(result.data, [
      "reportId",
      "id",
      "report"
    ]);

    const currentReport = reportsCreated.find(
      (report) => report.templateId === templateId
    );

    if (currentReport) {
      currentReport.status = "created";
      if (reportId) {
        currentReport.reportId = reportId;
      }
    }
  }

  const successfulReports = reportsCreated.filter(
    (report) => report.status === "created" && report.reportId
  );

  if (successfulReports.length === 0) {
    return {
      status: "error",
      reportsCreated,
      manualSteps,
      audits,
      executionTier,
      summary: "No reports were created successfully."
    };
  }

  await updateJobSummary(input.prisma, input.jobId, "Assembling dashboard");

  const dashboardResult = await executor.createDashboard({
    name: dashboardName,
    portalId: input.portalId
  });

  if (!dashboardResult.success) {
    return {
      status: "partial",
      reportsCreated,
      manualSteps: [
        ...manualSteps,
        buildCoworkInstruction({
          portalId: input.portalId,
          dashboardName,
          templateIds: successfulReports.map((report) => report.templateId),
          reason: dashboardResult.error ?? "Dashboard creation failed"
        })
      ],
      audits,
      executionTier,
      summary: `Created ${successfulReports.length} report(s), but dashboard assembly failed.`
    };
  }

  const dashboardId =
    extractIdentifier(dashboardResult.data, ["dashboardId", "id", "dashboard"]) ??
    undefined;
  const dashboardUrl = extractUrl(
    dashboardResult.data,
    `https://app-eu1.hubspot.com/reports/${encodeURIComponent(input.portalId)}`
  );

  for (const report of successfulReports) {
    if (!dashboardId || !report.reportId) {
      continue;
    }

    const attachResult = await executor.addReportToDashboard(
      dashboardId,
      report.reportId
    );

    if (!attachResult.success) {
      manualSteps.push(
        buildManualInstructionForTemplate({
          portalId: input.portalId,
          template: plannedReports.get(report.templateId)?.template ?? {
            id: report.templateId,
            name: report.name,
            section: report.section,
            chartType: "TABLE",
            requiredProperties: [],
            description: report.name,
            build: () => {
              throw new Error("Manual follow-up required");
            }
          },
          reason:
            attachResult.error ??
            `Add report ${report.reportId} to dashboard ${dashboardId} manually.`
        })
      );
    }
  }

  const failedCount = reportsCreated.filter(
    (report) => report.status === "failed"
  ).length;
  const status =
    failedCount === 0 && manualSteps.length === 0 ? "complete" : "partial";

  return {
    status,
    ...(dashboardId ? { dashboardId } : {}),
    ...(dashboardUrl ? { dashboardUrl } : {}),
    reportsCreated,
    manualSteps,
    audits,
    executionTier,
    summary:
      status === "complete"
        ? `Created ${successfulReports.length} report(s) and assembled ${dashboardName}.`
        : `Created ${successfulReports.length} report(s) with ${manualSteps.length} manual follow-up item(s).`
  };
}
