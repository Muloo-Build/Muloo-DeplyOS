import RetainerDetailWorkspace from "../../components/RetainerDetailWorkspace";

export default async function RetainerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RetainerDetailWorkspace retainerId={id} />;
}
