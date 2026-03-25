import Link from "next/link";

import AppShell from "../components/AppShell";

const operationsCards = [
  {
    label: "Portal Delivery",
    title: "Portal Ops",
    description:
      "Run natural-language HubSpot build requests, pick the target client portal, and return either a direct action path or a practical delivery plan.",
    href: "/projects/portal-ops",
    cta: "Open portal ops"
  },
  {
    label: "Execution Review",
    title: "Runs",
    description:
      "Review queued agent work, inspect execution briefs, and advance runs through review and completion.",
    href: "/runs",
    cta: "Open runs"
  },
  {
    label: "Agent Design",
    title: "Agent Studio",
    description:
      "Manage operational agents, their providers, models, triggers, and approval modes from one workspace.",
    href: "/agents",
    cta: "Open agents"
  },
  {
    label: "Repeatable Patterns",
    title: "Templates",
    description:
      "Maintain reusable delivery templates so common jobs start from a structured baseline instead of a blank slate.",
    href: "/templates",
    cta: "Open templates"
  }
];

export default function OperationsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Operations
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Operations Hub
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              Keep delivery execution tools together. Use this area for portal
              operations, agent review, automation oversight, and repeatable
              implementation patterns.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {operationsCards.map((card) => (
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
                  {card.cta}
                </Link>
              </section>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
