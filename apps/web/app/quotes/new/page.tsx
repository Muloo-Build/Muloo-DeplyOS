import QuickQuoteBuilder from "../../components/QuickQuoteBuilder";

export default function NewQuotePage({
  searchParams
}: {
  searchParams?: { source?: string };
}) {
  const sourceId =
    typeof searchParams?.source === "string" && searchParams.source.length > 0
      ? searchParams.source
      : undefined;
  return <QuickQuoteBuilder sourceId={sourceId} />;
}
