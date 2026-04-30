"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent
} from "react";

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

const statusGlossary: Array<{ status: string; description: string }> = [
  { status: "Draft", description: "Operator is still building this quote" },
  { status: "Sent", description: "Pushed to portal or emailed; awaiting client decision" },
  { status: "Approved", description: "Client clicked Approve in their portal" },
  { status: "Won", description: "Quote accepted and moved to delivery" },
  { status: "Lost", description: "Client declined or didn't progress" },
  { status: "Archived", description: "Manually retired; doesn't count in active pipeline" },
  { status: "Superseded", description: "Replaced by a newer version (created via Revise)" }
];

const SHOW_ARCHIVED_KEY = "quotes-list:show-archived-superseded";
const BULK_ARCHIVABLE = new Set(["superseded", "lost"]);

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
  const [showArchivedSuperseded, setShowArchivedSuperseded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SHOW_ARCHIVED_KEY);
      if (stored === "1") {
        setShowArchivedSuperseded(true);
      }
    } catch {
      // ignore localStorage failures (private mode, quota, etc)
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SHOW_ARCHIVED_KEY,
        showArchivedSuperseded ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, [showArchivedSuperseded]);

  async function loadQuotes() {
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

  useEffect(() => {
    void loadQuotes();
  }, []);

  const filtered = useMemo(() => {
    let list = quotes;
    if (statusFilter === "all") {
      if (!showArchivedSuperseded) {
        list = list.filter(
          (quote) =>
            quote.status !== "archived" && quote.status !== "superseded"
        );
      }
    } else {
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
  }, [quotes, statusFilter, search, showArchivedSuperseded]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    let allCount = 0;
    for (const quote of quotes) {
      map[quote.status] = (map[quote.status] ?? 0) + 1;
      if (
        showArchivedSuperseded ||
        (quote.status !== "archived" && quote.status !== "superseded")
      ) {
        allCount += 1;
      }
    }
    map.all = allCount;
    return map;
  }, [quotes, showArchivedSuperseded]);

  const visibleIds = useMemo(
    () => new Set(filtered.map((quote) => quote.id)),
    [filtered]
  );

  // Drop selections that are no longer visible
  useEffect(() => {
    setSelected((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visibleIds]);

  const selectedQuotes = useMemo(
    () => quotes.filter((quote) => selected.has(quote.id)),
    [quotes, selected]
  );
  const allSelectedArchivable =
    selectedQuotes.length > 0 &&
    selectedQuotes.every((quote) => BULK_ARCHIVABLE.has(quote.status));

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function executeBulkArchive() {
    if (selected.size === 0 || !allSelectedArchivable) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const response = await fetch("/api/quotes/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quoteIds: Array.from(selected) })
      });
      const body = (await response.json().catch(() => null)) as {
        archived?: Array<{ id: string }>;
        error?: string;
      } | null;
      if (!response.ok || !body?.archived) {
        throw new Error(body?.error ?? "Failed to archive quotes");
      }
      const count = body.archived.length;
      setFeedback(`Archived ${count} quote${count === 1 ? "" : "s"}`);
      window.setTimeout(() => setFeedback(null), 3500);
      setConfirmArchiveOpen(false);
      clearSelection();
      await loadQuotes();
    } catch (archiveError) {
      setBulkError(
        archiveError instanceof Error
          ? archiveError.message
          : "Failed to archive quotes"
      );
    } finally {
      setBulkBusy(false);
    }
  }

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

        {feedback ? (
          <div className="rounded-2xl border border-[#51d0b0]/30 bg-[#51d0b0]/10 px-4 py-3 text-sm text-[#9be4d2]">
            {feedback}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setGlossaryOpen((open) => !open)}
                aria-expanded={glossaryOpen}
                aria-label="Status glossary"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-background-card text-xs font-semibold text-text-secondary transition hover:border-white/20 hover:text-white"
              >
                ?
              </button>
              {glossaryOpen ? (
                <div
                  role="dialog"
                  aria-label="Quote status glossary"
                  className="absolute left-0 top-9 z-30 w-80 rounded-2xl border border-white/10 bg-[#111933] p-4 shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-text-muted">
                      Status glossary
                    </p>
                    <button
                      type="button"
                      onClick={() => setGlossaryOpen(false)}
                      aria-label="Close glossary"
                      className="text-xs text-text-muted hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                    {statusGlossary.map((entry) => (
                      <div key={entry.status} className="contents">
                        <dt className="font-semibold text-white">
                          {entry.status}
                        </dt>
                        <dd className="text-text-secondary">
                          {entry.description}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={showArchivedSuperseded}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setShowArchivedSuperseded(event.target.checked)
                }
              />
              Show archived &amp; superseded
            </label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client or title..."
              className="w-full max-w-xs rounded-xl border border-white/10 bg-background-card px-3 py-2.5 text-sm text-white placeholder:text-text-muted"
            />
          </div>
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#49cde1]/30 bg-[#49cde1]/10 px-4 py-3 text-sm text-[#9be4f0] sm:flex-row sm:items-center sm:justify-between">
            <span>
              {selected.size} selected
              {!allSelectedArchivable
                ? " · only superseded or lost quotes can be bulk-archived"
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-text-secondary transition hover:bg-white/5"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!allSelectedArchivable || bulkBusy}
                onClick={() => {
                  setBulkError(null);
                  setConfirmArchiveOpen(true);
                }}
                className="rounded-xl bg-[#49cde1] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[#71dbeb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Archive selected
              </button>
            </div>
          </div>
        ) : null}

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
              {filtered.map((quote) => {
                const checked = selected.has(quote.id);
                return (
                  <li
                    key={quote.id}
                    className="grid items-center gap-3 px-5 py-2 transition hover:bg-white/[0.03] sm:grid-cols-[auto_1fr]"
                  >
                    <label
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-background-card hover:border-white/20"
                      onClick={(event: MouseEvent) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(quote.id)}
                        aria-label={`Select ${quote.projectName} v${quote.version}`}
                      />
                    </label>
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="grid gap-3 py-2 sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.5fr] sm:items-center"
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
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {confirmArchiveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,18,0.84)] px-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[24px] border border-white/10 bg-[#111933] p-6 shadow-2xl">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-text-muted">
                Confirm archive
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                Archive {selected.size} quote{selected.size === 1 ? "" : "s"}?
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                Archived quotes are removed from the active pipeline but the
                history stays. You can re-include them with the{" "}
                <span className="text-white">Show archived &amp; superseded</span>{" "}
                toggle.
              </p>
            </div>
            {bulkError ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {bulkError}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setConfirmArchiveOpen(false)}
                disabled={bulkBusy}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-text-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeBulkArchive()}
                disabled={bulkBusy}
                className="rounded-xl bg-[#49cde1] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#71dbeb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkBusy ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
