import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveLatestQuoteIdForProject } from "../../../../lib/quotes/resolveLatestQuoteId";

export const dynamic = "force-dynamic";

export default async function PartnerProjectQuotePage({
  params
}: {
  params: { id: string };
}) {
  const cookieHeader = cookies()
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const quoteId = await resolveLatestQuoteIdForProject(params.id, {
    source: "internal",
    cookie: cookieHeader
  });

  if (!quoteId) {
    redirect(`/partner/projects/${encodeURIComponent(params.id)}?missingQuote=1`);
  }

  redirect(`/quotes/${encodeURIComponent(quoteId)}?mode=partner`);
}
