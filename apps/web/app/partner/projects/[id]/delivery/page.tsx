import Link from "next/link";

import ClientShell from "../../../../components/ClientShell";
import DeliveryBoard from "../../../../components/DeliveryBoard";
import { getPortalProjectPath } from "../../../../components/portalExperience";

export default function PartnerProjectDeliveryBoardPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ClientShell portalExperience="partner" title="Delivery Board">
      <div className="mb-6">
        <Link
          href={getPortalProjectPath("partner", params.id)}
          className="text-sm text-text-muted"
        >
          Back to project
        </Link>
      </div>
      <DeliveryBoard projectId={params.id} mode="partner" />
    </ClientShell>
  );
}
