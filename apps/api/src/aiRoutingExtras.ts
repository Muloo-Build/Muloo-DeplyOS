import { calculateCostUsd } from "@muloo/shared";

import { extractUsage, logAIUsageEvent } from "./aiUsage";
import { prisma } from "./prisma";

// ---------- Recommendations ----------------------------------------------
//
// Hardcoded picks per workflow. These are auditable in PRs rather than DB-
// stored so they can be reviewed alongside the prompts they ship with.

export interface WorkflowRecommendation {
  primary: { providerKey: string; model: string; reason: string };
  alternates: { providerKey: string; model: string; reason: string }[];
}

export const WORKFLOW_RECOMMENDATIONS: Record<string, WorkflowRecommendation> = {
  research: {
    primary: {
      providerKey: "perplexity",
      model: "sonar-pro",
      reason: "Web-grounded answers with citations are exactly what this workflow needs."
    },
    alternates: [
      {
        providerKey: "perplexity",
        model: "sonar-reasoning-pro",
        reason: "Deeper reasoning when a query needs synthesis rather than lookup."
      }
    ]
  },
  discovery_extract: {
    primary: {
      providerKey: "gemini",
      model: "gemini-2.5-pro",
      reason: "Long context + cheap structured extraction handle full transcripts well."
    },
    alternates: [
      {
        providerKey: "gemini",
        model: "gemini-2.5-flash",
        reason: "Cheaper for short notes when full Pro context is overkill."
      },
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Fallback when Gemini quality drifts on complex jargon."
      }
    ]
  },
  discovery_summary: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Best writing quality for operator-facing summaries."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4",
        reason: "Comparable writing with stronger structured output."
      }
    ]
  },
  blueprint_generation: {
    primary: {
      providerKey: "anthropic",
      model: "claude-opus-4-7",
      reason: "Frontier reasoning + 1M context for full project blueprints. Cost is justified by deliverable value."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Most blueprints don't need Opus; Sonnet is the cost-balanced default."
      }
    ]
  },
  blueprint_drafter: {
    primary: {
      providerKey: "anthropic",
      model: "claude-opus-4-7",
      reason: "Long-form technical drafting with consistent voice and high reasoning depth."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Use Sonnet for incremental edits to an existing blueprint."
      }
    ]
  },
  daily_summary: {
    primary: {
      providerKey: "anthropic",
      model: "claude-haiku-4-5",
      reason: "Fast and cheap for a daily digest read at one glance."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Comparable cost with slightly different summarisation style."
      }
    ]
  },
  meeting_extractor: {
    primary: {
      providerKey: "gemini",
      model: "gemini-2.5-flash",
      reason: "Very long context + cheap rates suit transcript extraction."
    },
    alternates: [
      {
        providerKey: "gemini",
        model: "gemini-2.5-pro",
        reason: "Use Pro when transcripts include heavy jargon and need higher fidelity."
      }
    ]
  },
  quote_drafter: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Consistent commercial-document voice and structured output."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Cheaper option for high-volume internal drafts."
      }
    ]
  },
  portal_audit: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Reliable JSON output with strong reasoning over portal snapshots."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4",
        reason: "Use OpenAI when JSON-mode strictness matters more than nuance."
      }
    ]
  },
  json_repair: {
    primary: {
      providerKey: "deepseek",
      model: "deepseek-v3.2",
      reason: "Cheap + follows formats reliably; ideal for re-shaping malformed output."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Fallback when DeepSeek availability is patchy."
      }
    ]
  },
  email_drafting: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Tone control + brevity for client-facing email drafts."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Cheaper option for transactional emails."
      }
    ]
  },
  agent_execution_brief: {
    primary: {
      providerKey: "openai",
      model: "gpt-5.4-mini",
      reason: "Cheap + structured outputs for queued executor briefs."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-haiku-4-5",
        reason: "Use Haiku when Anthropic is the rest-of-stack default."
      }
    ]
  },
  hubspot_operator_request: {
    primary: {
      providerKey: "openai",
      model: "gpt-5.4",
      reason: "Translates ambiguous natural-language requests into precise actions."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Fallback when OpenAI rate-limits on bursty operator usage."
      }
    ]
  },
  scoped_job_blueprint_generation: {
    primary: {
      providerKey: "openai",
      model: "gpt-5.4",
      reason: "Strong technical blueprint structure for standalone scoped jobs."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Comparable quality with a more conversational tone."
      }
    ]
  },
  scoped_job_summary: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Concise executive summaries that match Muloo voice."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Cheaper option for high volume."
      }
    ]
  },
  solution_shaping: {
    primary: {
      providerKey: "anthropic",
      model: "claude-opus-4-7",
      reason: "Pain-point synthesis benefits from Opus-level reasoning. Use sparingly — costliest model."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Cost-balanced when Opus is overkill for the discovery depth."
      },
      {
        providerKey: "openai",
        model: "gpt-5.4",
        reason: "Different reasoning style for A/B testing recommendations."
      }
    ]
  },
  project_email_drafting: {
    primary: {
      providerKey: "anthropic",
      model: "claude-sonnet-4-6",
      reason: "Tone-controlled drafts referencing live project context."
    },
    alternates: [
      {
        providerKey: "openai",
        model: "gpt-5.4-mini",
        reason: "Cheaper alternative for high-frequency project updates."
      }
    ]
  },
  project_prepare_brief: {
    primary: {
      providerKey: "openai",
      model: "gpt-5.4",
      reason: "Strong structured prep output for kickoff briefs."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Use Anthropic when the brief is more narrative than structured."
      }
    ]
  },
  agent_execution: {
    primary: {
      providerKey: "openai",
      model: "gpt-5.4",
      reason: "Robust tool-use and structured output for executor agents."
    },
    alternates: [
      {
        providerKey: "anthropic",
        model: "claude-sonnet-4-6",
        reason: "Switch to Anthropic when long-context reasoning matters more than tool fluency."
      }
    ]
  }
};

export function getWorkflowRecommendation(
  workflowKey: string
): WorkflowRecommendation | null {
  return WORKFLOW_RECOMMENDATIONS[workflowKey] ?? null;
}

// ---------- Prompt previews ----------------------------------------------
//
// Sample prompts we send during a "Test this workflow" run. Kept short and
// purposeful — the test is to prove credentials + model work end-to-end,
// not to benchmark prompt quality.

export interface WorkflowPromptTemplate {
  systemPrompt: string;
  samplePrompt: string;
}

const DEFAULT_TEMPLATE: WorkflowPromptTemplate = {
  systemPrompt:
    "You are a workflow test runner inside Muloo Deploy OS. Respond concisely.",
  samplePrompt:
    "Write a single sentence confirming you received this test and identify which model you are."
};

export const WORKFLOW_PROMPT_TEMPLATES: Record<string, WorkflowPromptTemplate> = {
  research: {
    systemPrompt:
      "You are a research assistant for a HubSpot and RevOps consultancy. Answer concisely with sources.",
    samplePrompt:
      "Give one bullet on the latest HubSpot Smart CRM update and cite the source URL."
  },
  discovery_extract: {
    systemPrompt:
      "You extract structured fields from raw discovery notes for a HubSpot consultancy.",
    samplePrompt:
      "From the line 'Client says they need pipeline visibility and lost-deal reasons by Q3', extract: goal, deadline, missing-data."
  },
  discovery_summary: {
    systemPrompt:
      "You write operator-friendly discovery summaries grounded in extracted facts.",
    samplePrompt:
      "In two sentences, summarise: 'Goal = pipeline visibility, deadline = Q3, missing = lost-reason capture.'"
  },
  blueprint_generation: {
    systemPrompt:
      "You generate phased HubSpot implementation blueprints from approved discovery scope.",
    samplePrompt:
      "Outline a 3-phase blueprint headline for a project that needs pipeline visibility + lost-reason capture by Q3."
  },
  blueprint_drafter: {
    systemPrompt:
      "You draft sections of a technical implementation blueprint.",
    samplePrompt:
      "Write a one-paragraph 'Pipeline Architecture' section for a B2B SaaS HubSpot setup."
  },
  daily_summary: {
    systemPrompt:
      "You produce a Command Centre digest for the workspace owner.",
    samplePrompt:
      "Two-line summary of yesterday's activity: '3 quotes sent, 1 approved, 2 portal audits completed, 1 task overdue.'"
  },
  meeting_extractor: {
    systemPrompt:
      "You extract decisions, actions, and risks from meeting transcripts.",
    samplePrompt:
      "From: 'Acme will sign by Friday but legal needs a redline.' Extract: decision, owner, deadline."
  },
  quote_drafter: {
    systemPrompt:
      "You pre-fill quote line costs based on a project brief.",
    samplePrompt:
      "Suggest one realistic line item (label + hours estimate) for a HubSpot pipeline cleanup project."
  },
  portal_audit: {
    systemPrompt:
      "You audit HubSpot portal snapshots and return JSON with healthScore + top issues.",
    samplePrompt:
      "Return JSON with healthScore (number) and one 'issue' string for a portal that has 30% required-field gaps."
  },
  json_repair: {
    systemPrompt:
      "You repair malformed JSON. Output only valid JSON, nothing else.",
    samplePrompt:
      "Repair this: { name: 'Acme', value: 42, "
  },
  email_drafting: {
    systemPrompt:
      "You draft client-facing emails in a warm, professional voice.",
    samplePrompt:
      "Two-sentence email confirming a discovery call is booked for Tuesday at 2pm SAST."
  },
  agent_execution_brief: {
    systemPrompt:
      "You translate operator requests into structured execution briefs for a queued agent.",
    samplePrompt:
      "Brief: 'Audit Acme's deal pipelines and flag stale stages.' Return one-sentence task scope."
  },
  hubspot_operator_request: {
    systemPrompt:
      "You translate plain-language HubSpot operator requests into either a safe direct action or a manual execution plan.",
    samplePrompt:
      "Request: 'Mark all stale deals over 90 days as closed-lost'. Return action type + safety check."
  },
  scoped_job_blueprint_generation: {
    systemPrompt:
      "You generate technical blueprints for standalone scoped HubSpot jobs.",
    samplePrompt:
      "Outline a blueprint headline for: 'Migrate companies from legacy CRM into HubSpot keeping owner mapping.'"
  },
  scoped_job_summary: {
    systemPrompt:
      "You write executive scope summaries for standalone scoped jobs.",
    samplePrompt:
      "Summarise in two lines: 'Migrate 5k companies from legacy CRM, deduplicate, preserve owner.'"
  },
  solution_shaping: {
    systemPrompt:
      "You turn discovery pain points into recommended HubSpot solution options.",
    samplePrompt:
      "For pain: 'Sales reps don't update deal stages.' Suggest one solution option in a single sentence."
  },
  project_email_drafting: {
    systemPrompt:
      "You draft project-status client emails that reference live project state.",
    samplePrompt:
      "Two-sentence weekly status email for a project currently in 'Build' phase, on track."
  },
  project_prepare_brief: {
    systemPrompt:
      "You generate prep briefs for upcoming client sessions.",
    samplePrompt:
      "One-bullet prep brief for a kickoff meeting with a B2B SaaS client about HubSpot pipeline cleanup."
  },
  agent_execution: {
    systemPrompt:
      "You execute task-level agent requests against a HubSpot context.",
    samplePrompt:
      "Confirm in one sentence that you received this execution test."
  }
};

export function getWorkflowPromptTemplate(
  workflowKey: string
): WorkflowPromptTemplate {
  return WORKFLOW_PROMPT_TEMPLATES[workflowKey] ?? DEFAULT_TEMPLATE;
}

// ---------- Test runner --------------------------------------------------
//
// Calls the saved provider+model for a workflow with a small sample prompt,
// stores the result on the WorkspaceAiRouting row, and emits an
// AIUsageEvent tagged with agentKey="test_route" so the spend dashboard
// reflects what testing costs.

interface ProviderConnectionRow {
  apiKey: string | null;
  endpointUrl: string | null;
  defaultModel: string | null;
}

async function loadProviderConnection(
  providerKey: string
): Promise<ProviderConnectionRow | null> {
  return prisma.workspaceProviderConnection.findUnique({
    where: { providerKey },
    select: { apiKey: true, endpointUrl: true, defaultModel: true }
  });
}

function envApiKeyFor(providerKey: string): string | null {
  switch (providerKey) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim() ?? null;
    case "openai":
      return process.env.OPENAI_API_KEY?.trim() ?? null;
    case "perplexity":
      return process.env.PERPLEXITY_API_KEY?.trim() ?? null;
    case "gemini":
      return (
        process.env.GEMINI_API_KEY?.trim() ??
        process.env.GOOGLE_AI_API_KEY?.trim() ??
        null
      );
    case "grok":
      return process.env.XAI_API_KEY?.trim() ?? null;
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY?.trim() ?? null;
    case "mistral":
      return process.env.MISTRAL_API_KEY?.trim() ?? null;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY?.trim() ?? null;
    default:
      return null;
  }
}

interface RunResult {
  status: "ok" | "error";
  errorMessage: string | null;
  outputPreview: string | null;
  promptTokens: number;
  completionTokens: number;
  modelUsed: string;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  template: WorkflowPromptTemplate
): Promise<RunResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [
        { role: "system", content: template.systemPrompt },
        { role: "user", content: template.samplePrompt }
      ]
    })
  });

  const body = (await response.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
        usage?: unknown;
      }
    | null;

  if (!response.ok || !body?.choices?.[0]?.message?.content) {
    return {
      status: "error",
      errorMessage:
        body?.error?.message ?? `HTTP ${response.status} ${response.statusText}`,
      outputPreview: null,
      promptTokens: 0,
      completionTokens: 0,
      modelUsed: model
    };
  }

  const usage = extractUsage(body);
  return {
    status: "ok",
    errorMessage: null,
    outputPreview: body.choices[0].message.content.slice(0, 600),
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
    modelUsed: model
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  template: WorkflowPromptTemplate,
  baseUrl: string
): Promise<RunResult> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      system: template.systemPrompt,
      messages: [{ role: "user", content: template.samplePrompt }]
    })
  });

  const body = (await response.json().catch(() => null)) as
    | {
        content?: { text?: string }[];
        error?: { message?: string };
        usage?: unknown;
      }
    | null;

  const text = body?.content?.[0]?.text;
  if (!response.ok || !text) {
    return {
      status: "error",
      errorMessage:
        body?.error?.message ?? `HTTP ${response.status} ${response.statusText}`,
      outputPreview: null,
      promptTokens: 0,
      completionTokens: 0,
      modelUsed: model
    };
  }

  const usage = extractUsage(body);
  return {
    status: "ok",
    errorMessage: null,
    outputPreview: text.slice(0, 600),
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
    modelUsed: model
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  template: WorkflowPromptTemplate,
  baseUrl: string
): Promise<RunResult> {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: template.systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: template.samplePrompt }] }
      ],
      generationConfig: { maxOutputTokens: 200, temperature: 0.2 }
    })
  });
  const body = (await response.json().catch(() => null)) as
    | {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
        usageMetadata?: unknown;
      }
    | null;
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!response.ok || !text) {
    return {
      status: "error",
      errorMessage:
        body?.error?.message ?? `HTTP ${response.status} ${response.statusText}`,
      outputPreview: null,
      promptTokens: 0,
      completionTokens: 0,
      modelUsed: model
    };
  }
  const usage = extractUsage(body);
  return {
    status: "ok",
    errorMessage: null,
    outputPreview: text.slice(0, 600),
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
    modelUsed: model
  };
}

const PROVIDER_DEFAULT_BASE: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  perplexity: "https://api.perplexity.ai",
  gemini: "https://generativelanguage.googleapis.com",
  grok: "https://api.x.ai/v1",
  deepseek: "https://api.deepseek.com",
  mistral: "https://api.mistral.ai/v1",
  openrouter: "https://openrouter.ai/api/v1"
};

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.4",
  perplexity: "sonar-pro",
  gemini: "gemini-2.5-pro",
  grok: "grok-4-fast",
  deepseek: "deepseek-v3.2",
  mistral: "mistral-large-2",
  openrouter: "openai/gpt-5.4"
};

async function runProviderCall(
  providerKey: string,
  model: string,
  template: WorkflowPromptTemplate,
  apiKey: string,
  endpointUrl: string | null
): Promise<RunResult> {
  const baseUrl = (endpointUrl?.trim() || PROVIDER_DEFAULT_BASE[providerKey]) ?? "";
  if (providerKey === "anthropic") {
    return callAnthropic(apiKey, model, template, baseUrl);
  }
  if (providerKey === "gemini") {
    return callGemini(apiKey, model, template, baseUrl);
  }
  // OpenAI-compatible: openai, perplexity, grok, deepseek, mistral, openrouter
  return callOpenAiCompatible(baseUrl, apiKey, model, template);
}

export async function runWorkflowTest(workflowKey: string) {
  const route = await prisma.workspaceAiRouting.findUnique({
    where: { workflowKey }
  });
  if (!route) {
    throw new Error(`Workflow "${workflowKey}" not found`);
  }

  const template = getWorkflowPromptTemplate(workflowKey);
  const connection = await loadProviderConnection(route.providerKey);
  const apiKey = connection?.apiKey?.trim() || envApiKeyFor(route.providerKey);
  const model =
    route.modelOverride?.trim() ||
    connection?.defaultModel?.trim() ||
    PROVIDER_DEFAULT_MODEL[route.providerKey] ||
    "";

  if (!apiKey) {
    const errorMessage = `No API key found for provider "${route.providerKey}". Add one under AI Integrations → Providers.`;
    const updated = await prisma.workspaceAiRouting.update({
      where: { workflowKey },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: "error",
        lastTestError: errorMessage,
        lastTestSampleOutput: null,
        lastTestLatencyMs: null,
        lastTestCostUsd: null,
        lastTestModel: model || null
      }
    });
    return {
      route: serializeRouteWithTest(updated),
      template
    };
  }

  if (!model) {
    const errorMessage = `No model resolved for provider "${route.providerKey}".`;
    const updated = await prisma.workspaceAiRouting.update({
      where: { workflowKey },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: "error",
        lastTestError: errorMessage,
        lastTestSampleOutput: null,
        lastTestLatencyMs: null,
        lastTestCostUsd: null,
        lastTestModel: null
      }
    });
    return { route: serializeRouteWithTest(updated), template };
  }

  const startedAt = Date.now();
  const result = await runProviderCall(
    route.providerKey,
    model,
    template,
    apiKey,
    connection?.endpointUrl ?? null
  );
  const latencyMs = Date.now() - startedAt;
  const { totalCostUsd } = calculateCostUsd(
    route.providerKey,
    model,
    result.promptTokens,
    result.completionTokens
  );

  logAIUsageEvent({
    providerKey: route.providerKey,
    model,
    tokens: {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens
    },
    latencyMs,
    agentKey: "test_route",
    workflowKey,
    errored: result.status === "error",
    errorMessage: result.errorMessage,
    metadata: { source: "ai_routing_test" }
  });

  const updated = await prisma.workspaceAiRouting.update({
    where: { workflowKey },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.status,
      lastTestError: result.errorMessage,
      lastTestSampleOutput: result.outputPreview,
      lastTestLatencyMs: latencyMs,
      lastTestCostUsd: totalCostUsd,
      lastTestModel: result.modelUsed
    }
  });

  return { route: serializeRouteWithTest(updated), template };
}

export function serializeRouteWithTest<
  T extends {
    id: string;
    workflowKey: string;
    label: string;
    providerKey: string;
    modelOverride: string | null;
    notes: string | null;
    lastTestedAt: Date | null;
    lastTestStatus: string | null;
    lastTestError: string | null;
    lastTestSampleOutput: string | null;
    lastTestLatencyMs: number | null;
    lastTestCostUsd: number | null;
    lastTestModel: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(route: T) {
  return {
    id: route.id,
    workflowKey: route.workflowKey,
    label: route.label,
    providerKey: route.providerKey,
    modelOverride: route.modelOverride,
    notes: route.notes,
    lastTestedAt: route.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: route.lastTestStatus,
    lastTestError: route.lastTestError,
    lastTestSampleOutput: route.lastTestSampleOutput,
    lastTestLatencyMs: route.lastTestLatencyMs,
    lastTestCostUsd: route.lastTestCostUsd,
    lastTestModel: route.lastTestModel,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString()
  };
}

// Bulk save: takes an array of {workflowKey, providerKey, modelOverride, notes}
// and updates all rows in one transaction. Returns the updated list.
export async function bulkSaveAiRouting(
  items: {
    workflowKey: string;
    providerKey?: string | null | undefined;
    modelOverride?: string | null | undefined;
    notes?: string | null | undefined;
  }[]
) {
  const updates = items.map((item) => {
    const data: Record<string, unknown> = {};
    if (typeof item.providerKey === "string" && item.providerKey.trim()) {
      data.providerKey = item.providerKey.trim();
    }
    if (item.modelOverride !== undefined) {
      data.modelOverride =
        typeof item.modelOverride === "string" && item.modelOverride.trim()
          ? item.modelOverride.trim()
          : null;
    }
    if (item.notes !== undefined) {
      data.notes =
        typeof item.notes === "string" && item.notes.trim()
          ? item.notes.trim()
          : null;
    }
    return prisma.workspaceAiRouting.update({
      where: { workflowKey: item.workflowKey },
      data
    });
  });

  const results = await prisma.$transaction(updates);
  return results.map((r) => serializeRouteWithTest(r));
}

export async function loadAiRoutingWithTest() {
  const routes = await prisma.workspaceAiRouting.findMany({
    orderBy: [{ label: "asc" }]
  });
  return routes.map((r) => serializeRouteWithTest(r));
}
