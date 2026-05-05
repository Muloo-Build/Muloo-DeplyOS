import ProjectsListView from "../components/ProjectsListView";

export default function ProjectsPage({
  searchParams
}: {
  searchParams?: { status?: string };
}) {
  return <ProjectsListView initialStatus={searchParams?.status ?? null} />;
}
