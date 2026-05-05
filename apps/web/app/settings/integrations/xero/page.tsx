import SettingsShell from "../../../components/SettingsShell";

export default function SettingsIntegrationsXeroPage() {
  return (
    <SettingsShell
      title="Xero"
      subtitle="Send invoices to Xero and pull contact / account data so billing stays aligned with delivery."
    >
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
          Coming soon
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Xero integration is in design
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          We will support OAuth 2.0 connection to your Xero org, push of
          DeployOS invoices, and reconciliation against retainer ledgers.
        </p>
      </div>
    </SettingsShell>
  );
}
