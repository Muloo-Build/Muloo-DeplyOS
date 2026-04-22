import ClientTopUpApprovalWorkspace from "../../../../../components/ClientTopUpApprovalWorkspace";

export default async function ClientTopUpApprovalPage({
  params
}: {
  params: Promise<{ retainerId: string; topUpId: string }>;
}) {
  const { retainerId, topUpId } = await params;
  return (
    <ClientTopUpApprovalWorkspace retainerId={retainerId} topUpId={topUpId} />
  );
}
