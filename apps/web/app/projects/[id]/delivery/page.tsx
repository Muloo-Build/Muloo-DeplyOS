import Link from "next/link";
import AppShell from "../../../components/AppShell";
import Breadcrumb from "../../../components/Breadcrumb";
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
        <Breadcrumb
          items={[
            { label: "Projects", href: "/projects" },
            { label: "Delivery Board" }
          ]}
        />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading text-white">
              Delivery Board
            </h1>
            <p className="mt-2 text-text-secondary">
              Load the right delivery templates and run the working board for
              this project.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${params.id}/changes`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Change log
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
