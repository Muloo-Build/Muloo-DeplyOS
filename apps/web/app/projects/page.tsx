import ProjectsDashboard from "../components/ProjectsDashboard";

export default function ProjectsPage({
  searchParams
}: {
  searchParams?: { status?: string };
}) {
  return <ProjectsDashboard initialStatus={searchParams?.status ?? null} />;
}
