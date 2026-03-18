import DiscoveryOutputDocument from "../../../components/DiscoveryOutputDocument";

export default function ProjectProposalPage({
  params
}: {
  params: { id: string };
}) {
  return <DiscoveryOutputDocument projectId={params.id} />;
}
