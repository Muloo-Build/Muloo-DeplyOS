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

async function callAuditModel(
  system: string,
  user: string,
  providerKey: string,
  modelId?: string
): Promise<string> {
  if (providerKey === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
    const model = modelId ?? "gpt-4o";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
    const body = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null;
    if (!response.ok || !body?.choices?.[0]?.message?.content) {
      throw new Error(body?.error?.message ?? "OpenAI portal audit request failed");
    }
    return body.choices[0].message.content;
  }

  if (providerKey === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_AI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    const model = modelId ?? "gemini-2.5-pro";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 1800 }
        })
      }
    );
    const body = (await response.json().catch(() => null)) as
      | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } }
      | null;
    if (!response.ok || !body?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error(body?.error?.message ?? "Gemini portal audit request failed");
    }
    return body.candidates[0].content!.parts![0].text!;
  }

  // Default: Anthropic Claude
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const model = modelId ?? "claude-sonnet-4-20250514";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model, max_tokens: 1800, system, messages: [{ role: "user", content: user }] })
  });
  const body = (await response.json().catch(() => null)) as
    | { content?: Array<{ text?: string }>; error?: { message?: string } }
    | null;
  if (!response.ok || !body?.content?.[0]?.text) {
    throw new Error(body?.error?.message ?? "Anthropic portal audit request failed");
  }
  return body.content[0].text;
}

export async function runPortalAudit(data: JobPayload): Promise<JobResult> {
  if (!data.portalId || !data.projectId) {
    throw new Error("portalId and projectId are required for portal_audit");
  }

  const [portalSession, hubspotPortal] = await Promise.all([
    prisma.portalSession.findFirst({
      where: { portalId: data.portalId, valid: true },
      orderBy: { capturedAt: "desc" }
    }),
    prisma.hubSpotPortal.findFirst({
      where: { portalId: data.portalId }
    })
  ]);

  // Use private app token if available, otherwise fall back to OAuth access token.
  // The OAuth connection already includes crm.schemas.*.write scopes so it can
  // create and update properties without a separate private app.
  const resolvedToken =
    portalSession?.privateAppToken?.trim() ||
    hubspotPortal?.accessToken?.trim();

  if (!resolvedToken) {
    const output: AuditOutput = {
      status: "queued_for_cowork",
      summary: "No HubSpot token available. Reconnect the portal in Settings → Providers.",
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
    privateAppToken: resolvedToken
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

  const providerKey = typeof data.providerKey === "string" ? data.providerKey : "anthropic";
  const modelId = typeof data.modelId === "string" ? data.modelId : undefined;
  const rawResponse = await callAuditModel(system, user, providerKey, modelId);
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
