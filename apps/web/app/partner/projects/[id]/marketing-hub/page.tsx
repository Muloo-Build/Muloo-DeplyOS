import PartnerMarketingHubWorkspace from "../../../../components/PartnerMarketingHubWorkspace";

export default function PartnerProjectMarketingHubPage({
  params
}: {
  params: { id: string };
}) {
  return <PartnerMarketingHubWorkspace projectId={params.id} />;
}
