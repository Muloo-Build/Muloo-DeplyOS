import ProjectWorkspaceLanding from "../../components/ProjectWorkspaceLanding";

export default function ProjectOverviewPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectWorkspaceLanding projectId={params.id} />;
}
