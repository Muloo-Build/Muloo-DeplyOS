import ProjectWorkspaceLanding from "../../components/ProjectWorkspaceLanding";

export default function ProjectOverviewPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { view?: string };
}) {
  return (
    <ProjectWorkspaceLanding
      projectId={params.id}
      forceSummary={searchParams?.view === "summary"}
    />
  );
}
