import Link from "next/link";

import SettingsShell from "../components/SettingsShell";

export default function SettingsPage() {
  return (
    <SettingsShell
      title="Workspace Settings"
      subtitle="Organize workspace administration into clearer areas for team access, provider connections, templates, and commercial setup."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {[
          {
            label: "Team",
            title: "Users and access levels",
            description:
              "Manage workspace users, roles, and future permission layers in a dedicated admin page.",
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
            label: "Products",
            title: "Commercial catalog",
            description:
              "Maintain products, retainers, and add-ons that can be pulled into quotes and approvals.",
            href: "/settings/products"
          },
          {
            label: "Templates",
            title: "Delivery templates",
            description:
              "Open the repeatable delivery-pattern library for theme installs, onboarding, migrations, and other jobs.",
            href: "/templates"
          }
        ].map((card) => (
          <section
            key={card.href}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
              {card.label}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {card.title}
            </h2>
            <p className="mt-3 text-text-secondary">{card.description}</p>
            <Link
              href={card.href}
              className="mt-5 inline-flex rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Open {card.label.toLowerCase()}
            </Link>
          </section>
        ))}
      </div>
    </SettingsShell>
  );
}
