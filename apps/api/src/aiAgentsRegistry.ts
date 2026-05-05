// Static registry of named agents that consume AI models.
// Used by the AI Integrations UI to show "what is running, on which model,
// at what spend" without scraping call sites at runtime.

export interface AIAgentDescriptor {
  key: string;
  label: string;
  description: string;
  defaultProviderKey: string;
  defaultModel: string;
  workflowKey?: string;
  fileRef: string;
}

export const AI_AGENT_REGISTRY: AIAgentDescriptor[] = [
  {
    key: "workspace_assistant",
    label: "Workspace assistant",
    description:
      "Embedded chat assistant inside the operator workspace — answers context-grounded questions about projects.",
    defaultProviderKey: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    fileRef: "apps/api/src/app.ts:948"
  },
  {
    key: "portal_assistant",
    label: "Portal assistant",
    description:
      "Client-facing assistant that runs inside client portals against the same context.",
    defaultProviderKey: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    fileRef: "apps/api/src/app.ts:1018"
  },
  {
    key: "daily_summary",
    label: "Daily summary generator",
    description:
      "Builds the morning Command Centre digest from yesterday's activity.",
    defaultProviderKey: "anthropic",
    defaultModel: "claude-haiku-4-5",
    workflowKey: "daily_summary",
    fileRef: "apps/api/src/server.ts:21254"
  },
  {
    key: "portal_audit",
    label: "Portal audit agent",
    description:
      "Walks a HubSpot portal snapshot and produces a CRM hygiene report.",
    defaultProviderKey: "openai",
    defaultModel: "gpt-5.4",
    workflowKey: "portal_audit",
    fileRef: "packages/executor/src/agents/portalAuditAgent.ts:576"
  },
  {
    key: "research_agent",
    label: "Research agent",
    description:
      "Web-grounded research with source citations. Used during discovery and quote prep.",
    defaultProviderKey: "perplexity",
    defaultModel: "sonar-pro",
    workflowKey: "research",
    fileRef: "apps/api/src/queue/processors/researchAgent.ts:3"
  },
  {
    key: "blueprint_drafter",
    label: "Blueprint drafter",
    description:
      "Drafts the technical blueprint after discovery context + summary are sealed.",
    defaultProviderKey: "anthropic",
    defaultModel: "claude-opus-4-7",
    workflowKey: "blueprint_drafter",
    fileRef: "apps/api/src/server.ts:27444"
  },
  {
    key: "quote_drafter",
    label: "Quote drafter",
    description:
      "Pre-fills quote line costs from the product catalog and prior quotes.",
    defaultProviderKey: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    workflowKey: "quote_drafter",
    fileRef: "apps/api/src/server.ts:27444"
  },
  {
    key: "meeting_extractor",
    label: "Meeting note extractor",
    description:
      "Pulls actions, risks, and decisions out of meeting transcripts and posts to the project RAID panel.",
    defaultProviderKey: "gemini",
    defaultModel: "gemini-2.5-flash",
    workflowKey: "meeting_extractor",
    fileRef: "apps/api/src/server.ts:27537"
  }
];

export function listAIAgents(): AIAgentDescriptor[] {
  return AI_AGENT_REGISTRY;
}

export function getAIAgent(key: string): AIAgentDescriptor | null {
  return AI_AGENT_REGISTRY.find((agent) => agent.key === key) ?? null;
}
