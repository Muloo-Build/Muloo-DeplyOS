import QuickQuoteDocument from "../../components/QuickQuoteDocument";

export default function QuoteDetailPage({
  params
}: {
  params: { id: string };
}) {
  return <QuickQuoteDocument quoteId={params.id} />;
}
