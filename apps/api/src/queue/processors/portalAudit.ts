import { Prisma } from "@prisma/client";
import { HubSpotWriteClient } from "@muloo/hubspot-client";
import type { CoworkInstruction } from "@muloo/shared";
import { prisma } from "../../prisma";
import { JobPayload, JobResult } from "../jobRouter";

interface AuditIssue {
  severity: "critical" | "medium" | "low";
  title: string;
  detail: string;
}

interface AuditOutput {
  status: "complete" | "partial" | "queued_for_cowork";
  summary: string;
  healthScore?: number;
  issues?: AuditIssue[];
  quickWins?: string[];
  executionTier?: 2 | 3;
  coworkInstruction?: CoworkInstruction;
}

function buildCoworkInstruction(portalId: string): CoworkInstruction {
  return {
    id: `cowork-portal-audit-${portalId}-${Date.now()}`,
    taskType: "hubspot_report_create",
    portalId,
    targetUrl: `https://app-eu1.hubspot.com/settings/${encodeURIComponent(portalId)}/integrations/private-apps`,
    steps: [
      {
        order: 1,
        action: "navigate",
        target: "HubSpot private apps settings",
        description: "Open the target portal's private app settings."
      },
      {
        order: 2,
        action: "verify",
        target: "Private app token",
        description:
          "Create or copy a private app token with properties, pipelines, workflows, and marketing scopes."
      },
      {
        order: 3,
        action: "fill_field",
        target: "Muloo DeployOS Portal Ops",
        description:
          "Save the token into Portal Ops so the audit and property agents can run."
      }
    ],
    expectedOutcome:
      "A private app token is saved for this portal and the portal audit can be retried.",
    fallbackToManual: []
  };
}

function extractJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }

    return null;
  }
}

async function callClaudeAudit(system: string, user: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  const body = (await response.json().catch(() => null)) as
    | { content?: Array<{ text?: string }>; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.content?.[0]?.text) {
    throw new Error(body?.error?.message || "Anthropic portal audit request failed");
  }

  return body.content[0].text;
}

export async function runPortalAudit(data: JobPayload): Promise<JobResult> {
  if (!data.portalId || !data.projectId) {
    throw new Error("portalId and projectId are required for portal_audit");
  }

  const portalSession = await prisma.portalSession.findFirst({
    where: { portalId: data.portalId, valid: true },
    orderBy: { capturedAt: "desc" }
  });

  if (!portalSession?.privateAppToken?.trim()) {
    const output: AuditOutput = {
      status: "queued_for_cowork",
      summary: "Private app token missing. Portal audit queued for cowork follow-up.",
      executionTier: 3,
      coworkInstruction: buildCoworkInstruction(data.portalId)
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

  const client = new HubSpotWriteClient({
    portalId: data.portalId,
    privateAppToken: portalSession.privateAppToken
  });

  const latestSnapshot = await prisma.portalSnapshot.findFirst({
    where: { portalId: data.portalId },
    orderBy: { capturedAt: "desc" }
  });

  const [contactProperties, pipelines, workflows] = await Promise.all([
    client.listProperties("contacts"),
    client.getPipelines("deals"),
    client.getWorkflows()
  ]);

  const system =
    "You are a HubSpot implementation expert auditing a client portal for a consultancy called Muloo. Return strict JSON only.";
  const user = `Audit this portal and return JSON with keys: healthScore (0-100 number), summary (string), issues (array of {severity,title,detail}), quickWins (array of strings).\n\nContact properties:\n${JSON.stringify(
    contactProperties.slice(0, 250),
    null,
    2
  )}\n\nDeal pipelines:\n${JSON.stringify(pipelines, null, 2)}\n\nWorkflows:\n${JSON.stringify(
    workflows.slice(0, 100),
    null,
    2
  )}\n\nLatest portal snapshot:\n${JSON.stringify(latestSnapshot, null, 2)}\n\nTop 10 issues only. Quick wins max 5.`;

  const rawResponse = await callClaudeAudit(system, user);
  const parsed = extractJsonObject<{
    healthScore?: number;
    summary?: string;
    issues?: AuditIssue[];
    quickWins?: string[];
  }>(rawResponse);

  const output: AuditOutput = {
    status: "complete",
    summary: parsed?.summary?.trim() || "Portal audit completed.",
    issues: Array.isArray(parsed?.issues) ? parsed.issues.slice(0, 10) : [],
    quickWins: Array.isArray(parsed?.quickWins)
      ? parsed.quickWins.slice(0, 5)
      : [],
    executionTier: 2,
    ...(typeof parsed?.healthScore === "number"
      ? { healthScore: parsed.healthScore }
      : {})
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
