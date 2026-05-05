import ClientDetailView from "../../components/ClientDetailView";

export default function ClientDetailPage({
  params
}: {
  params: { id: string };
}) {
  return <ClientDetailView clientId={params.id} />;
}
