import ContributorWorkbookClient from "./ContributorWorkbookClient";

export const dynamic = "force-dynamic";

export default function ContributorTokenPage({
  params
}: {
  params: { token: string };
}) {
  return <ContributorWorkbookClient token={params.token} />;
}
