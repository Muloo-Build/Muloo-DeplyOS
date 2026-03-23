import Link from "next/link";
import AppShell from "../../../components/AppShell";
import DeliveryBoard from "../../../components/DeliveryBoard";
import ProjectWorkflowNav from "../../../components/ProjectWorkflowNav";

export default function ProjectDeliveryBoardPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <AppShell>
      <div className="p-8">
        <ProjectWorkflowNav projectId={params.id} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/projects/${params.id}`}
              className="text-sm text-text-muted"
            >
              Back to overview
            </Link>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Delivery Board
            </h1>
            <p className="mt-2 text-text-secondary">
              Generated project plan and working delivery board for this project.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${params.id}`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Project Overview
            </Link>
            <Link
              href={`/projects/${params.id}/changes`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Change Mgmt
            </Link>
            <Link
              href={`/projects/${params.id}/quote`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Open Quote
            </Link>
          </div>
        </div>
        <DeliveryBoard projectId={params.id} />
      </div>
    </AppShell>
  );
}
