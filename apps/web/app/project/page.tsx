import { redirect } from "next/navigation";

export default function ProjectRedirect({
  searchParams
}: {
  searchParams: { id?: string };
}) {
  if (searchParams.id) {
    redirect(`/projects/${searchParams.id}`);
  }

  redirect("/projects");
}
