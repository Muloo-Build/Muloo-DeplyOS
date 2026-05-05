import Link from "next/link";
import AppShell from "../../../components/AppShell";
import DeliveryBoard from "../../../components/DeliveryBoard";
import { Btn } from "../../../components/ui/Btn";
import { PageHead } from "../../../components/ui/PageHead";

export default function ProjectDeliveryBoardPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${params.id}`}
              className="hover:text-text-1 transition-colors"
            >
              ← Project workspace
            </Link>
          }
          title="Delivery"
          lede="Load the right delivery templates and run the working board for this project."
          actions={
            <>
              <Link href={`/projects/${params.id}/changes`}>
                <Btn variant="ghost" size="md">
                  Change log
                </Btn>
              </Link>
              <Link href={`/projects/${params.id}/quote`}>
                <Btn variant="ghost" size="md">
                  Open quote
                </Btn>
              </Link>
            </>
          }
        />
        <DeliveryBoard projectId={params.id} />
      </div>
    </AppShell>
  );
}
