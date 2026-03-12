import ProjectOverview from "../../components/ProjectOverview";

export default function ProjectOverviewPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectOverview projectId={params.id} />;
}
