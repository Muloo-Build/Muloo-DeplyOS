import ProjectChangeManagementWorkspace from "../../../components/ProjectChangeManagementWorkspace";

export default function ProjectChangesPage({
  params
}: {
  params: { id: string };
}) {
  return <ProjectChangeManagementWorkspace projectId={params.id} />;
}
