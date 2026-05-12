import Link from "next/link";
import DeliveryBoard from "../../../components/DeliveryBoard";
import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";
import { Btn } from "../../../components/ui/Btn";
import { PageHead } from "../../../components/ui/PageHead";

export default function ProjectDeliveryBoardPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ProjectWorkspaceView projectId={params.id} activeTab="delivery">
      <div className="space-y-6">
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
    </ProjectWorkspaceView>
  );
}
