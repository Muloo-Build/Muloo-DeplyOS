import AppShell from "../../../components/AppShell";
import PortalAuditWorkspace from "../../../components/PortalAuditWorkspace";

export default function ProjectAuditPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <AppShell>
      <div className="p-8">
        <PortalAuditWorkspace projectId={params.id} />
      </div>
    </AppShell>
  );
}
