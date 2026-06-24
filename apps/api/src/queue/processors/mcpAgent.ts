import Anthropic from "@anthropic-ai/sdk";

import { extractUsage, logAIUsageEvent } from "../../aiUsage";
import type { JobPayload, JobResult } from "../jobRouter";
import {
  HUBSPOT_MCP_SERVER_URL,
  buildHubSpotMcpToolsetConfigs,
  resolveHubSpotMcpToken,
} from "../../hubspotMcpOAuth";

const MODEL = "claude-opus-4-8";
const MCP_BETA = "mcp-client-2025-11-20" as const;
const MAX_CONTINUATIONS = 10;

interface McpAgentPayload {
  portalId: string;
  projectId?: string;
  task: string;
}

interface McpToolAction {
  name: string;
  serverName?: string;
  input: unknown;
  isError?: boolean;
}

export async function runMcpAgent(data: JobPayload): Promise<JobResult> {
  const payload = (data.payload ?? {}) as Partial<McpAgentPayload>;
  const portalId = payload.portalId ?? data.portalId;
  if (!portalId || !payload.task) {
    throw new Error("portalId and task are required for mcp_agent");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const token = await resolveHubSpotMcpToken(portalId);
  const client = new Anthropic({ apiKey });
  const startedAt = Date.now();

  // BetaMessageParam is the correct SDK type for conversation turns.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: payload.task },
  ];
  const actions: McpToolAction[] = [];
  const textOut: string[] = [];

  // BetaUsage uses input_tokens / output_tokens (Anthropic shape).
  // extractUsage() maps these to { promptTokens, completionTokens } for logAIUsageEvent.
  let lastRawUsage: Anthropic.Beta.BetaUsage | undefined;
  let errored = false;
  let errorMessage: string | null = null;

  try {
    for (let i = 0; i < MAX_CONTINUATIONS; i += 1) {
      // The SDK natively types mcp_servers, betas, and BetaMCPToolset on
      // beta.messages.create — no cast required for this version (0.105+).
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8192,
        // BetaThinkingConfigAdaptive: { type: "adaptive" }
        thinking: { type: "adaptive" },
        betas: [MCP_BETA],
        messages,
        // BetaRequestMCPServerURLDefinition: type, url, name, authorization_token
        mcp_servers: [
          {
            type: "url",
            url: HUBSPOT_MCP_SERVER_URL,
            name: "hubspot",
            authorization_token: token,
          },
        ],
        // BetaMCPToolset: type, mcp_server_name, configs (keyed by tool name → BetaMCPToolConfig)
        tools: [
          {
            type: "mcp_toolset",
            mcp_server_name: "hubspot",
            configs: buildHubSpotMcpToolsetConfigs(),
          },
        ],
      });

      lastRawUsage = response.usage;

      for (const block of response.content) {
        if (block.type === "text") {
          // BetaTextBlock — narrowed by block.type
          textOut.push(block.text);
        } else if (block.type === "mcp_tool_use") {
          // BetaMCPToolUseBlock — narrowed by block.type
          // Fields: id, name, server_name, input, type
          actions.push({
            name: block.name,
            serverName: block.server_name,
            input: block.input,
          });
        } else if (block.type === "mcp_tool_result") {
          // BetaMCPToolResultBlock — narrowed by block.type
          // Fields: tool_use_id, is_error, content, type
          const last = actions[actions.length - 1];
          if (last) {
            last.isError = block.is_error;
          }
        }
      }

      if (response.stop_reason === "refusal") {
        errored = true;
        errorMessage = "Agent refused the task";
        break;
      }
      if (response.stop_reason === "pause_turn") {
        // Server-side loop is paused — re-send with the assistant turn appended.
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      // end_turn, max_tokens, or any other terminal reason — stop looping.
      break;
    }
  } catch (error) {
    errored = true;
    errorMessage = error instanceof Error ? error.message : "mcp_agent failed";
  }

  // extractUsage handles the Anthropic shape: maps input_tokens → promptTokens,
  // output_tokens → completionTokens. Wrap raw usage in { usage: ... } to match
  // the extractUsage convention (it reads obj.usage internally).
  const tokens = lastRawUsage
    ? extractUsage({ usage: lastRawUsage })
    : {};

  logAIUsageEvent({
    providerKey: "anthropic",
    model: MODEL,
    tokens,
    latencyMs: Date.now() - startedAt,
    agentKey: "mcp_agent",
    projectId: payload.projectId ?? null,
    errored,
    errorMessage,
  });

  return {
    success: !errored,
    dryRun: data.dryRun ?? false,
    output: {
      status: errored ? "error" : "complete",
      summary: textOut.join("\n").slice(0, 4000),
      actions,
      errorMessage,
    },
  };
}
