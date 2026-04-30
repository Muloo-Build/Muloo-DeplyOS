interface QuoteListEntry {
  id: string;
  status: string;
  updatedAt: string;
}

export interface ResolveLatestQuoteOptions {
  source?: "internal" | "client";
  cookie?: string;
}

const HIDDEN_STATUSES = new Set(["archived", "superseded"]);

function resolveServerApiBase() {
  const explicit = process.env.MULOO_INTERNAL_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const port = process.env.API_PORT?.trim() || "3001";
  return `http://localhost:${port}`;
}

export async function resolveLatestQuoteIdForProject(
  projectId: string,
  options: ResolveLatestQuoteOptions = {}
): Promise<string | null> {
  const source = options.source ?? "internal";
  const path =
    source === "client"
      ? `/api/client/projects/${encodeURIComponent(projectId)}/quotes`
      : `/api/projects/${encodeURIComponent(projectId)}/quotes`;

  const isServer = typeof window === "undefined";
  const url = isServer ? `${resolveServerApiBase()}${path}` : path;

  const headers: Record<string, string> = {};
  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as
    | { quotes?: QuoteListEntry[] }
    | null;
  const quotes = body?.quotes ?? [];
  const eligible = quotes.filter((quote) => !HIDDEN_STATUSES.has(quote.status));
  if (eligible.length === 0) {
    return null;
  }

  eligible.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return eligible[0]?.id ?? null;
}
