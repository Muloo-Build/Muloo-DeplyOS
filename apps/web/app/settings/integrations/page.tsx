import Link from "next/link";

import SettingsShell from "../../components/SettingsShell";

interface IntegrationCard {
  href: string;
  title: string;
  badge: string;
  description: string;
  status: "live" | "preview" | "coming-soon";
  cta: string;
}

const integrations: IntegrationCard[] = [
  {
    href: "/settings/integrations/hubspot",
    title: "HubSpot",
    badge: "CRM",
    description:
      "Connect Muloo's HubSpot portal via private app for two-way sync. Cherry-pick companies, contacts, and deals to import as Clients.",
    status: "live",
    cta: "Open settings →"
  },
  {
    href: "/settings/integrations/xero",
    title: "Xero",
    badge: "Finance",
    description:
      "Connect your Xero org via OAuth, push DeployOS invoices, and reconcile against retainer ledgers. Connection lives under Workspace settings.",
    status: "live",
    cta: "Open settings →"
  },
  {
    href: "/settings/integrations/google",
    title: "Google Workspace",
    badge: "Email + Calendar",
    description:
      "Sign in with Google, send mailbox-routed email, and pull calendar context into the Command Centre. Email + calendar are configured today; Drive surface coming next.",
    status: "live",
    cta: "Open settings →"
  }
];

const statusStyles: Record<IntegrationCard["status"], string> = {
  live: "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]",
  preview: "bg-[rgba(255,200,80,0.14)] text-[#ffd28a]",
  "coming-soon": "bg-[rgba(255,255,255,0.06)] text-text-muted"
};

const statusLabels: Record<IntegrationCard["status"], string> = {
  live: "Available",
  preview: "Preview",
  "coming-soon": "Coming soon"
};

export default function SettingsIntegrationsPage() {
  return (
    <SettingsShell
      title="Integrations"
      subtitle="Connect external systems Muloo writes to or reads from. Each integration owns its own credentials, scopes, and sync rules."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {integrations.map((integration) => (
          <Link
            key={integration.title}
            href={integration.href}
            className="block rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 transition-colors hover:border-[rgba(255,255,255,0.18)]"
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
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[integration.status]}`}
              >
                {statusLabels[integration.status]}
              </span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              {integration.description}
            </p>
            <p className="mt-5 text-xs text-text-muted">{integration.cta}</p>
          </Link>
        ))}
      </div>
    </SettingsShell>
  );
}
