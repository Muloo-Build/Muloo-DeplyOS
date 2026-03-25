import type { Prisma, PrismaClient } from "@prisma/client";
import {
  HubSpotClient,
  type DealHealthResult,
  type EmailHealthResult,
  type FormActivityResult,
  type ListSummary,
  type PipelineSummaryResult,
  type PropertyAuditResult,
  type WorkflowSummaryResult
} from "@muloo/hubspot-client";
import { getApiKey } from "@muloo/shared";
import type { Logger } from "@muloo/core";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_AUDIT_MODEL = process.env.OPENAI_AUDIT_MODEL || "gpt-4o";
const MAX_ITERATIONS = 20;
const REQUIRED_INSPECTION_TOOLS = [
  "get_workflows",
  "get_pipelines",
  "get_contact_property_audit",
  "get_email_health",
  "get_active_lists",
  "get_form_activity",
  "get_deal_health"
] as const;

const SYSTEM_PROMPT = `You are a HubSpot portal health auditor. Your job is to systematically inspect a HubSpot portal and identify issues, inefficiencies, and risks.

Use the available tools to gather data across workflows, pipelines, contact properties, email performance, lists, forms, and deal health. Be methodical — call each tool at least once before forming conclusions.

When you have gathered enough evidence, call complete_audit with your findings array. Each finding should be specific, evidence-backed, and actionable. Do not include generic advice. Only report issues you have actual data for.

Severity guide:
- critical: data loss risk, broken core process, or compliance issue
- high: significant inefficiency or process gap affecting revenue/delivery
- medium: best practice violation or cleanup opportunity
- low: cosmetic or minor optimisation`;

type AuditSeverity = "critical" | "high" | "medium" | "low";
type AuditCategory =
  | "workflow_health"
  | "pipeline"
  | "properties"
  | "email_health"
  | "lists"
  | "forms"
  | "deal_health"
  | "general";

interface AuditFinding {
  title: string;
  severity: AuditSeverity;
  category: AuditCategory;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

const AUDIT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_workflows",
      description: "Inspect workflow inventory and stale automation patterns.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pipelines",
      description: "Inspect deal and ticket pipelines.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_contact_property_audit",
      description: "Inspect contact properties for sprawl, duplicates, and missing descriptions.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_email_health",
      description: "Inspect recent marketing email performance.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_active_lists",
      description: "Inspect list volume, stale lists, and unusually large lists.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_form_activity",
      description: "Inspect forms for inactivity and abandonment.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_deal_health",
      description: "Inspect open deal hygiene and stuck or overdue deals.",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_audit",
      description: "Finish the audit and submit all findings once every inspection tool has been used.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["findings"],
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "severity",
                "category",
                "description",
                "evidence",
                "recommendation"
              ],
              properties: {
                title: { type: "string" },
                severity: {
                  type: "string",
                  enum: ["critical", "high", "medium", "low"]
                },
                category: {
                  type: "string",
                  enum: [
                    "workflow_health",
                    "pipeline",
                    "properties",
                    "email_health",
                    "lists",
                    "forms",
                    "deal_health",
                    "general"
                  ]
                },
                description: { type: "string" },
                evidence: { type: "object", additionalProperties: true },
                recommendation: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
] as const;

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {}
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArea(category: AuditCategory) {
  switch (category) {
    case "workflow_health":
      return "workflows";
    case "pipeline":
      return "pipelines";
    case "properties":
      return "properties";
    case "email_health":
      return "reporting";
    case "lists":
      return "views";
    case "forms":
      return "crm";
    case "deal_health":
      return "data_quality";
    default:
      return "crm";
  }
}

function normalizeRecommendationType(severity: AuditSeverity) {
  return severity === "low" || severity === "medium"
    ? "quick_win"
    : "structural";
}

function normalizeRecommendationEffort(severity: AuditSeverity) {
  switch (severity) {
    case "critical":
      return "l";
    case "high":
      return "m";
    case "medium":
      return "s";
    case "low":
      return "xs";
  }
}

function normalizeRecommendationImpact(severity: AuditSeverity) {
  return severity === "low" ? "low" : severity === "medium" ? "medium" : "high";
}

function normalizePhaseRecommendation(severity: AuditSeverity) {
  return severity === "critical" || severity === "high" ? "now" : "phase 1";
}

function buildCompletionSummary(findings: AuditFinding[]) {
  const criticalCount = findings.filter(
    (finding) => finding.severity === "critical"
  ).length;
  const highCount = findings.filter(
    (finding) => finding.severity === "high"
  ).length;

  return `Audit complete. ${findings.length} findings identified (${criticalCount} critical, ${highCount} high).`;
}

async function updateJob(
  prisma: PrismaClient,
  jobId: string,
  data: {
    status?: string;
    resultStatus?: string | null;
    outputSummary?: string | null;
    outputLog?: string | null;
    errorLog?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
) {
  await prisma.executionJob.update({
    where: { id: jobId },
    data
  });
}

async function buildPortalAuditClient(
  prisma: PrismaClient,
  portalId: string
) {
  const portal = await prisma.hubSpotPortal.findUnique({
    where: { id: portalId },
    select: {
      id: true,
      accessToken: true,
      scopes: true
    }
  });

  if (!portal?.accessToken) {
    throw new Error("HubSpot portal access token not available for audit");
  }

  return new HubSpotClient({
    accessToken: portal.accessToken,
    scopes: portal.scopes,
    logger: silentLogger
  });
}

async function callHubSpotTool(
  client: HubSpotClient,
  name: string,
  portalId: string
): Promise<
  | WorkflowSummaryResult
  | PipelineSummaryResult
  | PropertyAuditResult
  | EmailHealthResult
  | ListSummary
  | FormActivityResult
  | DealHealthResult
  | { error: string }
> {
  try {
    switch (name) {
      case "get_workflows":
        return client.getWorkflows(portalId);
      case "get_pipelines":
        return client.getPipelines(portalId);
      case "get_contact_property_audit":
        return client.getContactPropertyAudit(portalId);
      case "get_email_health":
        return client.getEmailHealthMetrics(portalId);
      case "get_active_lists":
        return client.getActiveListSummary(portalId);
      case "get_form_activity":
        return client.getFormActivity(portalId);
      case "get_deal_health":
        return client.getDealHealthMetrics(portalId);
      default:
        return { error: `Unsupported audit tool: ${name}` };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "HubSpot tool failed"
    };
  }
}

function parseFindingsFromArguments(argumentsText: string) {
  const parsed = JSON.parse(argumentsText) as { findings?: unknown };
  if (!Array.isArray(parsed.findings)) {
    throw new Error("complete_audit must include a findings array");
  }

  return parsed.findings.reduce<AuditFinding[]>((accumulator, entry) => {
    if (!isRecord(entry)) {
      return accumulator;
    }

    const title =
      typeof entry.title === "string" ? entry.title.trim() : "";
    const severity =
      entry.severity === "critical" ||
      entry.severity === "high" ||
      entry.severity === "medium" ||
      entry.severity === "low"
        ? entry.severity
        : null;
    const category =
      entry.category === "workflow_health" ||
      entry.category === "pipeline" ||
      entry.category === "properties" ||
      entry.category === "email_health" ||
      entry.category === "lists" ||
      entry.category === "forms" ||
      entry.category === "deal_health" ||
      entry.category === "general"
        ? entry.category
        : null;
    const description =
      typeof entry.description === "string" ? entry.description.trim() : "";
    const recommendation =
      typeof entry.recommendation === "string"
        ? entry.recommendation.trim()
        : "";

    if (
      !title ||
      !severity ||
      !category ||
      !description ||
      !recommendation ||
      !isRecord(entry.evidence)
    ) {
      return accumulator;
    }

    accumulator.push({
      title,
      severity,
      category,
      description,
      evidence: entry.evidence,
      recommendation
    });
    return accumulator;
  }, []);
}

async function callOpenAiAudit(
  apiKey: string,
  messages: ChatCompletionMessage[]
) {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_AUDIT_MODEL,
      messages,
      tools: AUDIT_TOOLS,
      tool_choice: "auto"
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string } | string;
        choices?: Array<{
          message?: ChatCompletionMessage;
        }>;
      }
    | null;

  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message;
    throw new Error(
      errorMessage || `OpenAI audit request failed with status ${response.status}`
    );
  }

  const message = payload?.choices?.[0]?.message;
  if (!message) {
    throw new Error("OpenAI audit request returned no message");
  }

  return message;
}

async function writeFindings(
  findings: AuditFinding[],
  ctx: {
    jobId: string;
    projectId: string;
    portalId: string;
    prisma: PrismaClient;
  }
) {
  const dedupedFindings = Array.from(
    new Map(
      findings.map((finding) => [
        `${finding.category}:${finding.title.trim().toLowerCase()}`,
        finding
      ])
    ).values()
  );

  await ctx.prisma.$transaction(
    async (transaction: Prisma.TransactionClient) => {
    const existingAuditFindings = await transaction.finding.findMany({
      where: {
        projectId: ctx.projectId,
        source: "ai_audit"
      },
      select: { id: true }
    });
      const existingAuditFindingIds = existingAuditFindings.map(
        (finding: { id: string }) => finding.id
      );

    if (existingAuditFindingIds.length > 0) {
      await transaction.recommendation.deleteMany({
        where: {
          projectId: ctx.projectId,
          OR: [
            { findingId: { in: existingAuditFindingIds } },
            { linkedFindingIds: { hasSome: existingAuditFindingIds } }
          ]
        }
      });
    }

      await transaction.finding.deleteMany({
        where: {
          projectId: ctx.projectId,
          source: "ai_audit"
        }
      });

      for (const finding of dedupedFindings) {
        const createdFinding = await transaction.finding.create({
          data: {
            projectId: ctx.projectId,
            area: normalizeArea(finding.category),
            severity: finding.severity,
            source: "ai_audit",
            category: finding.category,
            title: finding.title,
            description: finding.description,
            quickWin:
              finding.severity === "low" || finding.severity === "medium",
            phaseRecommendation: normalizePhaseRecommendation(finding.severity),
            evidence: finding.evidence as Prisma.InputJsonValue,
            status: "open"
          }
        });

        await transaction.recommendation.create({
          data: {
            projectId: ctx.projectId,
            findingId: createdFinding.id,
            title: `Fix: ${finding.title}`,
            area: createdFinding.area,
            type: normalizeRecommendationType(finding.severity),
            phase: normalizePhaseRecommendation(finding.severity),
            rationale: finding.recommendation,
            effort: normalizeRecommendationEffort(finding.severity),
            impact: normalizeRecommendationImpact(finding.severity),
            clientApprovalStatus: "pending",
            linkedFindingIds: [createdFinding.id]
          }
        });
      }
    }
  );

  await updateJob(ctx.prisma, ctx.jobId, {
    status: "COMPLETED",
    resultStatus: "completed",
    completedAt: new Date(),
    outputSummary: buildCompletionSummary(dedupedFindings),
    outputLog: JSON.stringify(
      {
        findingCount: dedupedFindings.length,
        categories: dedupedFindings.reduce<Record<string, number>>(
          (accumulator, finding) => {
            accumulator[finding.category] =
              (accumulator[finding.category] ?? 0) + 1;
            return accumulator;
          },
          {}
        )
      },
      null,
      2
    ),
    errorLog: null
  });
}

export async function runPortalAuditAgent(input: {
  jobId: string;
  projectId: string;
  portalId: string;
  workspaceId: string;
  prisma: PrismaClient;
}): Promise<void> {
  const apiKey = await getApiKey(input.workspaceId, "openai", input.prisma);
  if (!apiKey) {
    await updateJob(input.prisma, input.jobId, {
      status: "FAILED",
      resultStatus: "failed",
      completedAt: new Date(),
      outputSummary:
        "OpenAI API key not configured. Go to Settings → API Keys to add it.",
      errorLog: "OpenAI API key missing"
    });
    return;
  }

  try {
    const hubspotClient = await buildPortalAuditClient(
      input.prisma,
      input.portalId
    );
    const messages: ChatCompletionMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Audit HubSpot portal. Project ID: ${input.projectId}. Be thorough.`
      }
    ];

    const calledInspectionTools = new Set<string>();
    let iterations = 0;
    let completed = false;

    while (!completed && iterations < MAX_ITERATIONS) {
      iterations += 1;

      await updateJob(input.prisma, input.jobId, {
        outputSummary: `Running audit - iteration ${iterations}`,
        status: "RUNNING",
        resultStatus: "running",
        ...(iterations === 1 ? { startedAt: new Date() } : {})
      });

      const message = await callOpenAiAudit(apiKey, messages);
      messages.push(
        message.tool_calls
          ? {
              role: "assistant",
              content: message.content ?? null,
              tool_calls: message.tool_calls
            }
          : {
              role: "assistant",
              content: message.content ?? null
            }
      );

      if (!message.tool_calls?.length) {
        break;
      }

      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;

        if (name === "complete_audit") {
          const missingTools = REQUIRED_INSPECTION_TOOLS.filter(
            (toolName) => !calledInspectionTools.has(toolName)
          );

          if (missingTools.length > 0) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: `Audit cannot complete yet. Call all inspection tools first: ${missingTools.join(", ")}`
              })
            });
            continue;
          }

          const findings = parseFindingsFromArguments(toolCall.function.arguments);
          if (findings.length === 0) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: "complete_audit returned no valid findings"
              })
            });
            continue;
          }

          await writeFindings(findings, input);
          completed = true;
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: true, count: findings.length })
          });
          break;
        }

        calledInspectionTools.add(name);
        const result = await callHubSpotTool(hubspotClient, name, input.portalId);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    if (!completed) {
      await updateJob(input.prisma, input.jobId, {
        status: "FAILED",
        resultStatus: "failed",
        completedAt: new Date(),
        outputSummary:
          "Audit incomplete - agent did not produce findings within iteration limit.",
        errorLog:
          "Agent loop exited without complete_audit or exceeded iteration limit."
      });
    }
  } catch (error) {
    await updateJob(input.prisma, input.jobId, {
      status: "FAILED",
      resultStatus: "failed",
      completedAt: new Date(),
      outputSummary:
        error instanceof Error ? error.message : "Portal audit agent failed",
      errorLog: error instanceof Error ? error.stack ?? error.message : String(error)
    });
  }
}
