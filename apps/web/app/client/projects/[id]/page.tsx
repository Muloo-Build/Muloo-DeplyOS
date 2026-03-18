import ClientProjectWorkspace from "../../../components/ClientProjectWorkspace";

export default function ClientProjectPage({
  params
}: {
  params: { id: string };
}) {
  return <ClientProjectWorkspace projectId={params.id} />;
}
