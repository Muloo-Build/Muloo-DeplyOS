import ClientProjectWorkspace from "../../../components/ClientProjectWorkspace";

export default function PartnerProjectPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <ClientProjectWorkspace
      projectId={params.id}
      portalExperience="partner"
    />
  );
}
