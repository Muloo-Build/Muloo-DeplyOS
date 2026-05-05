// Static catalog of AI models per provider.
// Costs are USD per 1M tokens. Source-of-truth in this file (auditable in PRs).
// A scheduled job can refresh-suggest by hitting /v1/models on each provider.

export type AIProviderKey =
  | "anthropic"
  | "openai"
  | "gemini"
  | "perplexity"
  | "grok"
  | "deepseek"
  | "mistral"
  | "openrouter";

export type AIModelTier = "frontier" | "balanced" | "fast" | "reasoning";

export interface AIModelEntry {
  id: string;
  label: string;
  contextK: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  tier: AIModelTier;
  releasedAt: string;
  deprecated?: boolean;
  notes?: string;
}

export interface AIProviderEntry {
  key: AIProviderKey;
  label: string;
  description: string;
  apiBase: string;
  scopesNote?: string;
  models: AIModelEntry[];
}

export const AI_MODEL_CATALOG: Record<AIProviderKey, AIProviderEntry> = {
  anthropic: {
    key: "anthropic",
    label: "Anthropic / Claude",
    description: "Frontier reasoning, long-form writing, agentic tool use.",
    apiBase: "https://api.anthropic.com",
    models: [
      {
        id: "claude-opus-4-7",
        label: "Claude Opus 4.7 (1M context)",
        contextK: 1000,
        inputCostPer1M: 15,
        outputCostPer1M: 75,
        tier: "frontier",
        releasedAt: "2026-01"
      },
      {
        id: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        contextK: 200,
        inputCostPer1M: 3,
        outputCostPer1M: 15,
        tier: "balanced",
        releasedAt: "2025-09"
      },
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        contextK: 200,
        inputCostPer1M: 0.8,
        outputCostPer1M: 4,
        tier: "fast",
        releasedAt: "2025-10"
      },
      {
        id: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4 (legacy)",
        contextK: 200,
        inputCostPer1M: 3,
        outputCostPer1M: 15,
        tier: "balanced",
        releasedAt: "2025-05",
        deprecated: true
      }
    ]
  },
  openai: {
    key: "openai",
    label: "OpenAI / ChatGPT",
    description: "GPT-5 family. Strong general reasoning + tools.",
    apiBase: "https://api.openai.com/v1",
    models: [
      {
        id: "gpt-5.4",
        label: "GPT-5.4",
        contextK: 400,
        inputCostPer1M: 5,
        outputCostPer1M: 20,
        tier: "frontier",
        releasedAt: "2026-01"
      },
      {
        id: "gpt-5.4-mini",
        label: "GPT-5.4 Mini",
        contextK: 200,
        inputCostPer1M: 0.6,
        outputCostPer1M: 2.4,
        tier: "balanced",
        releasedAt: "2026-01"
      },
      {
        id: "gpt-5.4-nano",
        label: "GPT-5.4 Nano",
        contextK: 128,
        inputCostPer1M: 0.1,
        outputCostPer1M: 0.4,
        tier: "fast",
        releasedAt: "2026-01"
      },
      {
        id: "o4-mini",
        label: "o4-mini (reasoning)",
        contextK: 200,
        inputCostPer1M: 1.1,
        outputCostPer1M: 4.4,
        tier: "reasoning",
        releasedAt: "2025-08"
      }
    ]
  },
  gemini: {
    key: "gemini",
    label: "Google Gemini",
    description: "Massive context window, multimodal, tool calling.",
    apiBase: "https://generativelanguage.googleapis.com",
    models: [
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        contextK: 2000,
        inputCostPer1M: 1.25,
        outputCostPer1M: 10,
        tier: "frontier",
        releasedAt: "2025-11"
      },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        contextK: 1000,
        inputCostPer1M: 0.3,
        outputCostPer1M: 2.5,
        tier: "balanced",
        releasedAt: "2025-11"
      },
      {
        id: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        contextK: 1000,
        inputCostPer1M: 0.075,
        outputCostPer1M: 0.3,
        tier: "fast",
        releasedAt: "2025-11"
      }
    ]
  },
  perplexity: {
    key: "perplexity",
    label: "Perplexity / Sonar",
    description: "Web-grounded answers with source citations.",
    apiBase: "https://api.perplexity.ai",
    models: [
      {
        id: "sonar-pro",
        label: "Sonar Pro",
        contextK: 200,
        inputCostPer1M: 3,
        outputCostPer1M: 15,
        tier: "balanced",
        releasedAt: "2025-08"
      },
      {
        id: "sonar-reasoning-pro",
        label: "Sonar Reasoning Pro",
        contextK: 128,
        inputCostPer1M: 2,
        outputCostPer1M: 8,
        tier: "reasoning",
        releasedAt: "2025-09"
      },
      {
        id: "sonar",
        label: "Sonar (small)",
        contextK: 128,
        inputCostPer1M: 1,
        outputCostPer1M: 1,
        tier: "fast",
        releasedAt: "2025-08"
      }
    ]
  },
  grok: {
    key: "grok",
    label: "xAI / Grok",
    description: "Frontier reasoning with X data access. Fast tier available.",
    apiBase: "https://api.x.ai/v1",
    models: [
      {
        id: "grok-4",
        label: "Grok 4",
        contextK: 256,
        inputCostPer1M: 5,
        outputCostPer1M: 15,
        tier: "frontier",
        releasedAt: "2025-12"
      },
      {
        id: "grok-4-fast",
        label: "Grok 4 Fast",
        contextK: 256,
        inputCostPer1M: 0.4,
        outputCostPer1M: 1.6,
        tier: "fast",
        releasedAt: "2025-12"
      }
    ]
  },
  deepseek: {
    key: "deepseek",
    label: "DeepSeek",
    description: "Cost-efficient reasoning + chat. Open-weights friendly.",
    apiBase: "https://api.deepseek.com",
    models: [
      {
        id: "deepseek-v3.2",
        label: "DeepSeek V3.2",
        contextK: 128,
        inputCostPer1M: 0.28,
        outputCostPer1M: 0.42,
        tier: "balanced",
        releasedAt: "2025-12"
      },
      {
        id: "deepseek-r1",
        label: "DeepSeek R1 (reasoning)",
        contextK: 128,
        inputCostPer1M: 0.55,
        outputCostPer1M: 2.2,
        tier: "reasoning",
        releasedAt: "2025-09"
      }
    ]
  },
  mistral: {
    key: "mistral",
    label: "Mistral",
    description: "EU-hosted models. Good for code + structured output.",
    apiBase: "https://api.mistral.ai/v1",
    models: [
      {
        id: "mistral-large-2",
        label: "Mistral Large 2",
        contextK: 128,
        inputCostPer1M: 2,
        outputCostPer1M: 6,
        tier: "frontier",
        releasedAt: "2025-07"
      },
      {
        id: "codestral-25-08",
        label: "Codestral 25.08",
        contextK: 256,
        inputCostPer1M: 0.3,
        outputCostPer1M: 0.9,
        tier: "fast",
        releasedAt: "2025-08",
        notes: "Specialised for code."
      }
    ]
  },
  openrouter: {
    key: "openrouter",
    label: "OpenRouter (multi-provider)",
    description:
      "Single API key for ~200 models across providers. Cheapest path for experimentation; per-call cost varies by underlying model.",
    apiBase: "https://openrouter.ai/api/v1",
    scopesNote:
      "Uses pass-through pricing. Costs shown are best-effort; for accurate billing track via OpenRouter's dashboard.",
    models: [
      {
        id: "anthropic/claude-opus-4.7",
        label: "Claude Opus 4.7 via OpenRouter",
        contextK: 1000,
        inputCostPer1M: 15,
        outputCostPer1M: 75,
        tier: "frontier",
        releasedAt: "2026-01"
      },
      {
        id: "openai/gpt-5.4",
        label: "GPT-5.4 via OpenRouter",
        contextK: 400,
        inputCostPer1M: 5,
        outputCostPer1M: 20,
        tier: "frontier",
        releasedAt: "2026-01"
      },
      {
        id: "google/gemini-2.5-pro",
        label: "Gemini 2.5 Pro via OpenRouter",
        contextK: 2000,
        inputCostPer1M: 1.25,
        outputCostPer1M: 10,
        tier: "frontier",
        releasedAt: "2025-11"
      },
      {
        id: "x-ai/grok-4",
        label: "Grok 4 via OpenRouter",
        contextK: 256,
        inputCostPer1M: 5,
        outputCostPer1M: 15,
        tier: "frontier",
        releasedAt: "2025-12"
      },
      {
        id: "deepseek/deepseek-v3.2",
        label: "DeepSeek V3.2 via OpenRouter",
        contextK: 128,
        inputCostPer1M: 0.28,
        outputCostPer1M: 0.42,
        tier: "balanced",
        releasedAt: "2025-12"
      }
    ]
  }
};

export function listProviders(): AIProviderEntry[] {
  return Object.values(AI_MODEL_CATALOG);
}

export function getProvider(key: string): AIProviderEntry | null {
  return (AI_MODEL_CATALOG as Record<string, AIProviderEntry>)[key] ?? null;
}

export function getModel(
  providerKey: string,
  modelId: string
): AIModelEntry | null {
  const provider = getProvider(providerKey);
  if (!provider) return null;
  return provider.models.find((m) => m.id === modelId) ?? null;
}

export function calculateCostUsd(
  providerKey: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number
): { inputCostUsd: number; outputCostUsd: number; totalCostUsd: number } {
  const model = getModel(providerKey, modelId);
  if (!model) {
    return { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 };
  }
  const inputCostUsd = (promptTokens / 1_000_000) * model.inputCostPer1M;
  const outputCostUsd =
    (completionTokens / 1_000_000) * model.outputCostPer1M;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd
  };
}
