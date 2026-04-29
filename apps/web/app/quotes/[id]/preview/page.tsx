import QuickQuoteDocument from "../../../components/QuickQuoteDocument";

export default function QuotePreviewPage({
  params
}: {
  params: { id: string };
}) {
  return <QuickQuoteDocument quoteId={params.id} mode="preview" />;
}
