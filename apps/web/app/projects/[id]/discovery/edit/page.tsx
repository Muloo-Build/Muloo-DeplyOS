import DiscoveryWorkspace from "../../../../components/DiscoveryWorkspace";

export default function ProjectDiscoveryEditPage({
  params
}: {
  params: { id: string };
}) {
  return <DiscoveryWorkspace projectId={params.id} />;
}
