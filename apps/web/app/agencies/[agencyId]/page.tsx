import AgencyProfileWorkspace from "../../components/AgencyProfileWorkspace";

export default async function AgencyProfilePage({
  params
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  return <AgencyProfileWorkspace agencyId={agencyId} />;
}
