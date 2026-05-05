import AppShell from "../../../components/AppShell";
import ClientGovernanceWorkspace from "../../../components/ClientGovernanceWorkspace";

export default function ClientGovernancePage({
  params
}: {
  params: { id: string };
}) {
  return (
    <AppShell>
      <div className="p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
          Client governance
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Governance
        </h1>
        <p className="mt-2 max-w-3xl text-text-secondary">
          Track NDAs, master agreements, DPAs, and signed quote snapshots for
          this client. Sent agreements appear in the client portal for
          click-wrap signature.
        </p>
        <div className="mt-6">
          <ClientGovernanceWorkspace clientId={params.id} />
        </div>
      </div>
    </AppShell>
  );
}
