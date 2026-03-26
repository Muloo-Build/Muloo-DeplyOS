import ClientsWorkspace from "../../components/ClientsWorkspace";

export default function ClientDetailPage({
  params
}: {
  params: { id: string };
}) {
  return <ClientsWorkspace focusClientId={params.id} />;
}
