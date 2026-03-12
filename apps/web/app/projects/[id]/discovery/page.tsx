import DiscoveryWorkspace from "../../../components/DiscoveryWorkspace";

export default function ProjectDiscoveryPage({
  params
}: {
  params: { id: string };
}) {
  return <DiscoveryWorkspace projectId={params.id} />;
}
