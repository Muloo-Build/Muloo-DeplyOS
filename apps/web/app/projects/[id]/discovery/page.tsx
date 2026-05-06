import DiscoveryHubView from "../../../components/DiscoveryHubView";

export default function ProjectDiscoveryPage({
  params
}: {
  params: { id: string };
}) {
  return <DiscoveryHubView projectId={params.id} />;
}
