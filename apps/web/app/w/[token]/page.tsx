import PublicWorkbookClient from "./PublicWorkbookClient";

export const dynamic = "force-dynamic";

export default function PublicWorkbookPage({
  params
}: {
  params: { token: string };
}) {
  return <PublicWorkbookClient token={params.token} />;
}
