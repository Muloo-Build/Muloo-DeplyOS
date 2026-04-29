import QuickQuoteDocument from "../../../components/QuickQuoteDocument";

export default function ClientQuoteViewPage({
  params
}: {
  params: { id: string };
}) {
  return <QuickQuoteDocument quoteId={params.id} mode="client" />;
}
