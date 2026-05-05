import ProjectWorkspaceView from "../../components/ProjectWorkspaceView";

export default function ProjectOverviewPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectWorkspaceView projectId={params.id} />;
}
