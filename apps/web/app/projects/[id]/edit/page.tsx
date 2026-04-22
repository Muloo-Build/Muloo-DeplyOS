import ProjectEditWorkspace from "../../../components/ProjectEditWorkspace";

export default function ProjectEditPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectEditWorkspace projectId={params.id} />;
}
