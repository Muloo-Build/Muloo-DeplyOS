"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import EmptyState from "./EmptyState";
import { SkeletonRows } from "./LoadingSkeleton";

interface QuoteListItem {
  id: string;
  projectId: string;
  projectName: string;
  scopeType: string | null;
  projectStatus: string;
  clientId: string | null;
  clientName: string;
  clientSlug: string | null;
  version: number;
  status: string;
  template: string;
  totals: { grandTotalZar?: number } & Record<string, unknown>;
  currency: string;
  sharedAt: string;
  approvedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
}

const statusFilters: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "shared", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
  { value: "superseded", label: "Superseded" }
];

const statusStyles: Record<string, string> = {
  draft: "bg-white/5 text-text-secondary border border-white/10",
  shared: "bg-[#49cde1]/15 text-[#9be4f0] border border-[#49cde1]/30",
  approved: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
  won: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  lost: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
  archived: "bg-slate-500/15 text-slate-300 border border-slate-400/30",
  superseded: "bg-violet-500/15 text-violet-200 border border-violet-400/30"
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(amount: number | undefined, currency: string) {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export default function QuotesListWorkspace() {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/quotes", { credentials: "include" });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load quotes");
        }
        const body = (await response.json()) as { quotes: QuoteListItem[] };
        setQuotes(body.quotes);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load quotes"
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    let list = quotes;
    if (statusFilter !== "all") {
      list = list.filter((quote) => quote.status === statusFilter);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (quote) =>
          quote.projectName.toLowerCase().includes(term) ||
          quote.clientName.toLowerCase().includes(term)
      );
    }
    return list;
  }, [quotes, statusFilter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: quotes.length };
    for (const quote of quotes) {
      map[quote.status] = (map[quote.status] ?? 0) + 1;
    }
    return map;
  }, [quotes]);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#49cde1]">
              Sales
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Quotes
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Every quote across the workspace, draft to closed. Filter by
              status, search by client.
            </p>
          </div>
          <Link
            href="/quotes/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#51d0b0] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1]"
          >
            + New quote
          </Link>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const active = statusFilter === filter.value;
              const count = counts[filter.value] ?? 0;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-[#51d0b0]/50 bg-[#51d0b0]/10 text-[#9be4d2]"
                      : "border-white/10 bg-background-card text-text-secondary hover:border-white/20 hover:text-white"
                  }`}
                >
                  {filter.label}
                  <span className="text-[10px] text-text-muted">{count}</span>
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by client or title..."
            className="w-full max-w-xs rounded-xl border border-white/10 bg-background-card px-3 py-2.5 text-sm text-white placeholder:text-text-muted"
          />
        </div>

        <section className="rounded-2xl border border-white/10 bg-background-card">
          {loading ? (
            <SkeletonRows count={6} className="p-5" />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="flex flex-col items-center justify-center px-8 py-14 text-center"
              title={
                quotes.length === 0
                  ? "No quotes yet"
                  : "No quotes match this filter"
              }
              description={
                quotes.length === 0
                  ? "Quotes show up here once you create your first. Pick a client, set deal type, line items follow."
                  : "Try a different status filter or clear your search."
              }
              primaryCta={
                quotes.length === 0
                  ? { label: "Create your first quote", href: "/quotes/new" }
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {filtered.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.5fr] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {quote.projectName}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-muted">
                        v{quote.version}
                        {quote.scopeType === "standalone_quote"
                          ? " · standalone"
                          : ""}
                      </p>
                    </div>
                    <div className="text-sm text-text-secondary">
                      {quote.clientName || "—"}
                    </div>
                    <div className="text-sm text-white">
                      {formatMoney(
                        Number(quote.totals?.grandTotalZar ?? 0),
                        quote.currency
                      )}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          statusStyles[quote.status] ?? statusStyles.draft
                        }`}
                      >
                        {quote.status}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatDate(quote.updatedAt)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
