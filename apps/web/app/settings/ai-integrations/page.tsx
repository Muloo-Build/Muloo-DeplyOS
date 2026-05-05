import Link from "next/link";

import AIIntegrationsShell from "../../components/AIIntegrationsShell";

const cards = [
  {
    href: "/settings/ai-integrations/providers",
    title: "Providers",
    description:
      "Anthropic, OpenAI, Gemini, Grok, DeepSeek, Mistral, Perplexity, OpenRouter. Manage API keys, default models, and per-provider settings."
  },
  {
    href: "/settings/ai-integrations/spend",
    title: "Spend dashboard",
    description:
      "Cost and token usage by provider, model, agent, and project. Daily burn-down and top spenders."
  },
  {
    href: "/settings/ai-integrations/agents",
    title: "Agents",
    description:
      "Every AI agent in DeployOS, the model it runs on by default, and its 7-day spend."
  },
  {
    href: "/settings/ai-integrations/routing",
    title: "Routing",
    description:
      "Map workflows (discovery extract, blueprint, daily summary…) to a specific provider + model."
  },
  {
    href: "/settings/ai-integrations/budgets",
    title: "Budgets",
    description:
      "Soft monthly caps per provider with 50/80/100% alert thresholds."
  }
];

export default function SettingsAIIntegrationsPage() {
  return (
    <AIIntegrationsShell
      title="AI Integrations"
      subtitle="One place to manage AI providers, model selection, agent routing, spend, and budget alerts."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block bg-ink-1 border border-ink-4 rounded-[14px] p-5 transition-colors hover:border-ink-5 hover:bg-ink-2"
          >
            <h2 className="text-[16px] font-semibold text-text-1 -tracking-[0.01em]">
              {card.title}
            </h2>
            <p className="mt-2 text-[13px] text-text-2">{card.description}</p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-text-3 font-semibold">
              Open →
            </p>
          </Link>
        ))}
      </div>
    </AIIntegrationsShell>
  );
}
