import ClientRetainerWorkspace from "../../../components/ClientRetainerWorkspace";

export default async function ClientRetainerPage({
  params
}: {
  params: Promise<{ retainerId: string }>;
}) {
  const { retainerId } = await params;
  return <ClientRetainerWorkspace retainerId={retainerId} />;
}
