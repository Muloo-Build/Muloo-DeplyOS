import QuoteDocument from "../../../../components/QuoteDocument";

export default function ClientProjectQuotePage({
  params
}: {
  params: { id: string };
}) {
  return <QuoteDocument projectId={params.id} mode="client" />;
}
