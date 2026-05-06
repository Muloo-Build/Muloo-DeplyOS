import ScopeView from "../../../components/ScopeView";

export default function ProjectScopePage({
  params
}: {
  params: { id: string };
}) {
  return <ScopeView projectId={params.id} />;
}
