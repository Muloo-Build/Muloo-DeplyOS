import ClientsWorkspace from "../../components/ClientsWorkspace";

export default function PartnerDetailPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ClientsWorkspace focusClientId={params.id} workspaceMode="partners" />
  );
}
