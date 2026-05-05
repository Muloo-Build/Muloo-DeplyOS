import AppShell from "../../../components/AppShell";
import ClientSecurityWorkspace from "../../../components/ClientSecurityWorkspace";

export default function ClientSecurityPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <AppShell>
      <div className="p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
          Client security
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Security &amp; InfoSec
        </h1>
        <p className="mt-2 max-w-3xl text-text-secondary">
          Audit checklist for the client&apos;s HubSpot, Google Workspace, DNS,
          and compliance posture. Pass / fail / N/A per check, with risk level
          auto-derived from critical and high failures.
        </p>
        <div className="mt-6">
          <ClientSecurityWorkspace clientId={params.id} />
        </div>
      </div>
    </AppShell>
  );
}
