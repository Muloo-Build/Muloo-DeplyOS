import BlueprintWorkspace from "../../components/BlueprintWorkspace";

export default function BlueprintPage({
  params
}: {
  params: { projectId: string };
}) {
  return <BlueprintWorkspace projectId={params.projectId} />;
}
