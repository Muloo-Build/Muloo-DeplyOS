import { BrowserSessionExecutor } from "@muloo/browser-session-executor";
import { TemplateEngine, type TemplateConfig } from "@muloo/report-templates";
import type { CoworkInstruction } from "@muloo/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { JobPayload, JobResult } from "../jobRouter";

interface ReportInstallOutput {
  status: "installed" | "failed" | "queued_for_cowork";
  summary: string;
  installationId: string;
  templateSlug: string;
  hubspotReportId?: string;
  hubspotReportUrl?: string;
  error?: string;
  coworkInstruction?: CoworkInstruction;
}

function buildCoworkInstruction(
  portalId: string,
  templateName: string,
  templateSlug: string,
): CoworkInstruction {
  return {
    id: `cowork-report-install-${portalId}-${Date.now()}`,
    taskType: "hubspot_report_create",
    portalId,
    targetUrl: `https://app-eu1.hubspot.com/reports/${encodeURIComponent(portalId)}`,
    steps: [
      {
        order: 1,
        action: "navigate",
        target: "HubSpot reporting workspace",
        description: "Open the target portal reporting area.",
      },
      {
        order: 2,
        action: "verify",
        target: "Browser session connection",
        description:
          "Confirm a fresh PortalSession exists with a valid browser-authenticated CSRF token.",
      },
      {
        order: 3,
        action: "click",
        target: "Create report",
        description: `Install Standard Report Pack template ${templateName} (slug: ${templateSlug}).`,
      },
    ],
    expectedOutcome: `${templateName} appears in HubSpot for the target portal.`,
    fallbackToManual: [],
  };
}

export async function runReportInstall(data: JobPayload): Promise<JobResult> {
  if (!data.portalId) throw new Error("portalId required for report_install");
  const installationId =
    typeof data.payload?.installationId === "string"
      ? data.payload.installationId
      : "";
  if (!installationId) {
    throw new Error("payload.installationId required for report_install");
  }

  const installation = await prisma.reportInstallation.findUnique({
    where: { id: installationId },
    include: { template: true, portal: true },
  });

  if (!installation) {
    throw new Error(`ReportInstallation not found: ${installationId}`);
  }

  // installation.portalId is the internal HubSpotPortal.id FK; the external
  // HubSpot portal hub id (used by HubSpot APIs and the cowork URL) lives
  // on the related row's portalId column. Always derive the external id
  // from the loaded portal row.
  const externalPortalId = installation.portal.portalId;

  // Idempotency guard — if this row was already installed by an earlier job
  // attempt (BullMQ default attempts: 3) and the executionJobId matches the
  // current job, short-circuit. A fresh re-install must be initiated through
  // retryReportInstallation (which resets status to "pending").
  if (
    installation.status === "installed" &&
    installation.executionJobId === data.executionJobId
  ) {
    const output: ReportInstallOutput = {
      status: "installed",
      summary: `Already installed (idempotent skip).`,
      installationId: installation.id,
      templateSlug: installation.templateSlug,
      ...(installation.hubspotReportId
        ? { hubspotReportId: installation.hubspotReportId }
        : {}),
      ...(installation.hubspotReportUrl
        ? { hubspotReportUrl: installation.hubspotReportUrl }
        : {}),
    };
    return { success: true, dryRun: data.dryRun ?? false, output };
  }

  const engine = new TemplateEngine();
  const template = engine.getTemplate(installation.templateSlug);
  if (!template) {
    await prisma.reportInstallation.update({
      where: { id: installation.id },
      data: {
        status: "failed",
        errorMessage: `Template ${installation.templateSlug} not registered in TemplateEngine`,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    throw new Error(`Template ${installation.templateSlug} not registered`);
  }

  await prisma.reportInstallation.update({
    where: { id: installation.id },
    data: {
      status: "running",
      lastAttemptAt: new Date(),
      attemptCount: { increment: 1 },
      executionJobId: data.executionJobId,
    },
  });

  const portalSession = data.sessionId
    ? await prisma.portalSession.findUnique({ where: { id: data.sessionId } })
    : await prisma.portalSession.findFirst({
        // PortalSession.portalId stores the *external* HubSpot portal hub id
        // (see /api/portal-session/:portalId routes), not the internal
        // HubSpotPortal.id FK that ReportInstallation uses.
        where: { portalId: externalPortalId, valid: true },
        orderBy: { capturedAt: "desc" },
      });

  if (!portalSession?.csrfToken?.trim()) {
    const cowork = buildCoworkInstruction(
      externalPortalId,
      template.name,
      installation.templateSlug,
    );
    // Persist explicit cowork status — leaving the row at "running" would
    // misreport state in the UI and the retry button.
    await prisma.reportInstallation.update({
      where: { id: installation.id },
      data: {
        status: "cowork_pending",
        errorMessage:
          "Portal session missing — handed off for cowork follow-up.",
      },
    });
    const output: ReportInstallOutput = {
      status: "queued_for_cowork",
      summary:
        "Portal session missing — report install queued for cowork follow-up.",
      installationId: installation.id,
      templateSlug: installation.templateSlug,
      coworkInstruction: cowork,
    };
    await prisma.executionJob.update({
      where: { id: data.executionJobId },
      data: {
        outputSummary: output.summary,
        executionTier: 3,
        coworkInstruction: cowork as Prisma.InputJsonValue,
      },
    });
    return { success: true, dryRun: data.dryRun ?? false, output };
  }

  const executor = new BrowserSessionExecutor({
    portalId: externalPortalId,
    csrfToken: portalSession.csrfToken,
    baseUrl: portalSession.baseUrl,
  });
  const config: TemplateConfig = { portalId: externalPortalId };

  // Note on auth path: HubSpot does not expose a public REST endpoint for
  // creating Reports. The internal /api/reports/v2 endpoints require a
  // browser-session CSRF token, which is captured by the portal-session
  // surface (POST /api/portal-session) and stored on PortalSession. There
  // is no private-app-token alternative to swap in here today; if HubSpot
  // ever ships a public Reports-create API, fork the path here.

  try {
    // Re-install hardening — if this row already has a `hubspotReportId`
    // from a prior successful install, delete the old report first so the
    // re-run replaces rather than duplicates. We do not abort the install
    // if the delete fails: the prior report may have been removed in the
    // portal already, and the row's `lastInstalledAt`/`hubspotReportId`
    // will be overwritten by the create below regardless.
    // Track whether the prior report has been removed from HubSpot. If so,
    // the row's `hubspotReportId`/`hubspotReportUrl`/`lastInstalledAt`
    // values are now stale — they point at a report that no longer exists
    // — and we must clear them on the failure path below so the operator
    // UI cannot keep showing a "View" link to a deleted report.
    let priorReportRemoved = false;
    if (installation.hubspotReportId) {
      const priorReportId = installation.hubspotReportId;
      const deleteResult = await executor.deleteReport(priorReportId);
      if (deleteResult.success) {
        priorReportRemoved = true;
      } else {
        console.warn(
          `[report_install] failed to delete prior report ${priorReportId} for installation ${installation.id}: ${deleteResult.error ?? "unknown"}. Proceeding with fresh create — operator may need to clean up manually.`,
        );
      }
    }

    const reportDef = template.build(config);
    const createResult = await executor.createReport(reportDef);
    if (!createResult.success) {
      await prisma.reportInstallation.update({
        where: { id: installation.id },
        data: {
          status: "failed",
          errorMessage:
            createResult.error ?? "createReport returned no error message",
          // If we successfully removed the prior report from HubSpot but
          // then failed to create the replacement, blank out the stale
          // pointers so the UI does not surface a dead "View" link or a
          // misleading "last installed" timestamp.
          ...(priorReportRemoved
            ? {
                hubspotReportId: null,
                hubspotReportUrl: null,
                lastInstalledAt: null,
              }
            : {}),
        },
      });
      const output: ReportInstallOutput = {
        status: "failed",
        summary: `Failed to install ${template.name}.`,
        installationId: installation.id,
        templateSlug: installation.templateSlug,
        error: createResult.error ?? "unknown",
      };
      await prisma.executionJob.update({
        where: { id: data.executionJobId },
        data: { outputSummary: output.summary, executionTier: 2 },
      });
      return { success: true, dryRun: data.dryRun ?? false, output };
    }

    const data2 = (createResult.data ?? {}) as Record<string, unknown>;
    const reportId =
      typeof data2.reportId === "string"
        ? data2.reportId
        : typeof data2.id === "string"
          ? data2.id
          : undefined;
    const reportUrl =
      typeof data2.reportUrl === "string" ? data2.reportUrl : undefined;

    await prisma.reportInstallation.update({
      where: { id: installation.id },
      data: {
        status: "installed",
        hubspotReportId: reportId ?? null,
        hubspotReportUrl: reportUrl ?? null,
        errorMessage: null,
        lastInstalledAt: new Date(),
      },
    });

    const output: ReportInstallOutput = {
      status: "installed",
      summary: `Installed ${template.name}.`,
      installationId: installation.id,
      templateSlug: installation.templateSlug,
      ...(reportId ? { hubspotReportId: reportId } : {}),
      ...(reportUrl ? { hubspotReportUrl: reportUrl } : {}),
    };
    await prisma.executionJob.update({
      where: { id: data.executionJobId },
      data: { outputSummary: output.summary, executionTier: 2 },
    });
    return { success: true, dryRun: data.dryRun ?? false, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.reportInstallation.update({
      where: { id: installation.id },
      data: { status: "failed", errorMessage: message },
    });
    throw error;
  }
}
