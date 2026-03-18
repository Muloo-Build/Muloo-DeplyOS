import QuoteDocument from "../../../components/QuoteDocument";

export default function ProjectQuotePage({
  params
}: {
  params: { id: string };
}) {
  return <QuoteDocument projectId={params.id} />;
}
