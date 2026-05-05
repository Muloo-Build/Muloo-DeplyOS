import Link from "next/link";
import { ArrowRight } from "lucide-react";

import SettingsShell from "../components/SettingsShell";
import { Btn } from "../components/ui/Btn";
import { Panel, PanelBody } from "../components/ui/Panel";

const cards = [
  {
    label: "Workspace",
    title: "Command Centre connections",
    description:
      "Manage Google Calendar, Xero, and the AI routing that powers the daily Command Centre briefing.",
    href: "/settings/workspace"
  },
  {
    label: "Team",
    title: "Users and access levels",
    description:
      "Add and manage workspace users, set roles, and control who has access to the platform.",
    href: "/settings/team"
  },
  {
    label: "Providers",
    title: "AI and integration connections",
    description:
      "Store API keys, default models, and connection settings for Anthropic, OpenAI, Gemini, and HubSpot.",
    href: "/settings/providers"
  },
  {
    label: "AI Routing",
    title: "Workflow model routing",
    description:
      "Choose which provider and default model powers discovery extraction, summaries, blueprint generation, and repair workflows.",
    href: "/settings/ai-routing"
  },
  {
    label: "Email",
    title: "Outbound mail and notifications",
    description:
      "Connect SMTP from Google Workspace or another mail provider so project emails and notifications can send from your own domain.",
    href: "/settings/email"
  },
  {
    label: "Products",
    title: "Commercial catalog",
    description:
      "Maintain products, retainers, and add-ons that can be pulled into quotes and approvals.",
    href: "/settings/products"
  },
  {
    label: "Implementation Templates",
    title: "Delivery templates",
    description:
      "Open the repeatable delivery-pattern library for theme installs, onboarding, migrations, and other jobs.",
    href: "/templates"
  }
];

export default function SettingsPage() {
  return (
    <SettingsShell
      title="Settings"
      subtitle="Manage connections, team access, AI routing, email delivery, and the commercial and template libraries that power the workspace."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map((card) => (
          <Panel key={card.href}>
            <PanelBody>
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                {card.label}
              </p>
              <h2 className="mt-1.5 text-[16px] font-semibold text-text-1 -tracking-[0.01em]">
                {card.title}
              </h2>
              <p className="mt-2 text-[13px] text-text-2">{card.description}</p>
              <div className="mt-4">
                <Link href={card.href}>
                  <Btn variant="ghost" size="sm">
                    Open {card.label.toLowerCase()}
                    <ArrowRight size={11} />
                  </Btn>
                </Link>
              </div>
            </PanelBody>
          </Panel>
        ))}
      </div>
    </SettingsShell>
  );
}
