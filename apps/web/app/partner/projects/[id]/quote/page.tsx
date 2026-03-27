import QuoteDocument from "../../../../components/QuoteDocument";

export default function PartnerProjectQuotePage({
  params
}: {
  params: { id: string };
}) {
  return <QuoteDocument projectId={params.id} mode="partner" />;
}
