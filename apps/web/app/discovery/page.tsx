import { redirect } from "next/navigation";

export default function DiscoveryRedirect({
  searchParams
}: {
  searchParams: { id?: string };
}) {
  if (searchParams.id) {
    redirect(`/projects/${searchParams.id}/discovery`);
  }

  redirect("/projects");
}
