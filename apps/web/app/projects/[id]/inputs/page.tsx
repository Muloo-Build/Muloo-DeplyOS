import ProjectInputsWorkspace from "../../../components/ProjectInputsWorkspace";

export default function ProjectInputsPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectInputsWorkspace projectId={params.id} />;
}
