import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveLatestQuoteIdForProject } from "../../../../lib/quotes/resolveLatestQuoteId";

export const dynamic = "force-dynamic";

export default async function ClientProjectQuotePage({
  params
}: {
  params: { id: string };
}) {
  const cookieHeader = cookies()
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  const quoteId = await resolveLatestQuoteIdForProject(params.id, {
    source: "client",
    cookie: cookieHeader
  });

  if (!quoteId) {
    redirect(`/client/projects/${encodeURIComponent(params.id)}?missingQuote=1`);
  }

  redirect(`/client/quotes/${encodeURIComponent(quoteId)}`);
}
