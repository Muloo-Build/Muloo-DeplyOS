import Link from "next/link";

import SettingsShell from "../../../components/SettingsShell";

export default function SettingsIntegrationsXeroPage() {
  return (
    <SettingsShell
      title="Xero"
      subtitle="OAuth 2.0 connection to your Xero org. Push DeployOS invoices and reconcile against retainer ledgers."
    >
      <div className="space-y-5">
        <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Connection
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Xero is configured under Workspace settings
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-text-2">
                The OAuth connect, status, and disconnect controls live in
                Workspace settings (alongside Gmail and Google Calendar).
                That page is the source of truth — opening it from here keeps
                the existing flow intact.
              </p>
              <p className="mt-2 text-xs text-text-3">
                If you hit an OAuth error, check the
                <span className="text-white"> [xero-oauth] </span>
                lines in the Railway logs. The XERO_SCOPES env var lets you
                test with a minimal scope set without code changes.
              </p>
            </div>
            <Link
              href="/settings/workspace#xero"
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
            >
              Open Xero connection →
            </Link>
          </div>
        </section>

        <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            Roadmap
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text-2">
            <li>
              ✓ OAuth 2.0 connect, refresh, disconnect (live under Workspace
              settings)
            </li>
            <li>✓ Pull invoices into the Invoices workspace</li>
            <li>· Push DeployOS-issued invoices to Xero</li>
            <li>· Reconcile retainer top-ups against Xero invoice payments</li>
            <li>· Sync Xero contacts ↔ DeployOS Clients</li>
          </ul>
        </section>
      </div>
    </SettingsShell>
  );
}
