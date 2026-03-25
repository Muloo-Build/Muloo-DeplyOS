import ProjectPrepareWorkspace from "../../../components/ProjectPrepareWorkspace";

export default function ProjectPreparePage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectPrepareWorkspace projectId={params.id} />;
}
