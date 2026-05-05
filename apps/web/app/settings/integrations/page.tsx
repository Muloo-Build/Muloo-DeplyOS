import Link from "next/link";

import SettingsShell from "../../components/SettingsShell";

interface IntegrationCard {
  href: string | null;
  title: string;
  badge: string;
  description: string;
  status: "live" | "coming-soon";
}

const integrations: IntegrationCard[] = [
  {
    href: "/settings/integrations/hubspot",
    title: "HubSpot",
    badge: "CRM",
    description:
      "Connect Muloo's HubSpot portal via private app for two-way sync. Cherry-pick companies, contacts, and deals to import as Clients.",
    status: "live"
  },
  {
    href: "/settings/integrations/xero",
    title: "Xero",
    badge: "Finance",
    description:
      "Send invoices to Xero, pull in contact and account data to keep billing aligned with delivery.",
    status: "coming-soon"
  },
  {
    href: "/settings/integrations/google",
    title: "Google Workspace",
    badge: "Email + Drive",
    description:
      "Sign in with Google, send mailbox-routed email, and surface meeting notes from connected calendars.",
    status: "coming-soon"
  }
];

export default function SettingsIntegrationsPage() {
  return (
    <SettingsShell
      title="Integrations"
      subtitle="Connect external systems Muloo writes to or reads from. Each integration owns its own credentials, scopes, and sync rules."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {integrations.map((integration) => {
          const card = (
            <div
              key={integration.title}
              className="flex h-full flex-col rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 transition-colors hover:border-[rgba(255,255,255,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    {integration.badge}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {integration.title}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    integration.status === "live"
                      ? "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]"
                      : "bg-[rgba(255,255,255,0.06)] text-text-muted"
                  }`}
                >
                  {integration.status === "live"
                    ? "Available"
                    : "Coming soon"}
                </span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                {integration.description}
              </p>
              <div className="mt-auto pt-5">
                <span className="text-xs text-text-muted">
                  {integration.status === "live"
                    ? "Open settings →"
                    : "Preview →"}
                </span>
              </div>
            </div>
          );

          if (!integration.href) return card;
          return (
            <Link
              key={integration.title}
              href={integration.href}
              className="block"
            >
              {card}
            </Link>
          );
        })}
      </div>
    </SettingsShell>
  );
}
