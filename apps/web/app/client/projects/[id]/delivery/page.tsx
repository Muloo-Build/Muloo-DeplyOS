import Link from "next/link";
import ClientShell from "../../../../components/ClientShell";
import DeliveryBoard from "../../../../components/DeliveryBoard";

export default function ClientProjectDeliveryBoardPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ClientShell title="Delivery Board">
      <div className="mb-6">
        <Link
          href={`/client/projects/${params.id}`}
          className="text-sm text-text-muted"
        >
          Back to project
        </Link>
      </div>
      <DeliveryBoard projectId={params.id} mode="client" />
    </ClientShell>
  );
}
