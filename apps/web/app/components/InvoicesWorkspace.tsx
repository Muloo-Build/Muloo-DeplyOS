"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import EmptyState from "./EmptyState";
import { SkeletonRows } from "./LoadingSkeleton";

interface InvoiceListItem {
  id: string;
  reference: string;
  retainerId: string;
  retainerPeriodId: string | null;
  invoiceType: "RETAINER_BLOCK" | "TOP_UP" | "OTHER";
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  xeroUrl: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  notes: string | null;
  billToEntity: { id: string; name: string; type: string } | null;
  retainer: { id: string; client: { id: string; name: string } | null } | null;
}

const statusFilters: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" }
];

const statusStyles: Record<string, string> = {
  DRAFT: "bg-white/5 text-text-secondary border border-white/10",
  SENT: "bg-[#49cde1]/15 text-[#9be4f0] border border-[#49cde1]/30",
  PAID: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  OVERDUE: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
  VOID: "bg-slate-500/15 text-slate-300 border border-slate-400/30"
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatType(type: string) {
  if (type === "RETAINER_BLOCK") return "Retainer block";
  if (type === "TOP_UP") return "Top-up";
  return "Other";
}

export default function InvoicesWorkspace() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/invoices", {
          credentials: "include"
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load invoices");
        }
        const body = (await response.json()) as { invoices: InvoiceListItem[] };
        setInvoices(body.invoices);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load invoices"
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== "all") {
      list = list.filter((invoice) => invoice.status === statusFilter);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (invoice) =>
          invoice.reference.toLowerCase().includes(term) ||
          invoice.retainer?.client?.name?.toLowerCase().includes(term) ||
          invoice.billToEntity?.name?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [invoices, statusFilter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: invoices.length };
    for (const invoice of invoices) {
      map[invoice.status] = (map[invoice.status] ?? 0) + 1;
    }
    return map;
  }, [invoices]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    let overdue = 0;
    for (const inv of invoices) {
      if (inv.status === "SENT") outstanding += inv.amount;
      if (inv.status === "PAID") paid += inv.amount;
      if (inv.status === "OVERDUE") overdue += inv.amount;
    }
    return { outstanding, paid, overdue };
  }, [invoices]);

  const primaryCurrency = invoices[0]?.currency ?? "ZAR";

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#49cde1]">
              Sales
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Invoices
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Every invoice tied to a retainer or top-up. Filter by status,
              search by client or reference.
            </p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#49cde1]/30 bg-[#49cde1]/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#9be4f0]/80">
              Outstanding (sent)
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {formatMoney(totals.outstanding, primaryCurrency)}
            </p>
            <p className="mt-1 text-xs text-[#9be4f0]/70">
              {counts.SENT ?? 0} sent invoices
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/80">
              Paid
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {formatMoney(totals.paid, primaryCurrency)}
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              {counts.PAID ?? 0} paid invoices
            </p>
          </div>
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.32em] text-rose-200/80">
              Overdue
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {formatMoney(totals.overdue, primaryCurrency)}
            </p>
            <p className="mt-1 text-xs text-rose-200/70">
              {counts.OVERDUE ?? 0} overdue invoices
            </p>
          </div>
        </section>

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
            placeholder="Search by reference or client..."
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
                invoices.length === 0 ? "No invoices yet" : "No invoices match this filter"
              }
              description={
                invoices.length === 0
                  ? "Invoices appear here once you record a retainer block or approve a top-up. Once Xero is connected, drafts flow there too."
                  : "Adjust the status filter or clear the search to see more."
              }
              primaryCta={
                invoices.length === 0
                  ? { label: "Open retainers", href: "/retainers" }
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {filtered.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.6fr_0.5fr] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {invoice.reference}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-muted">
                        {formatType(invoice.invoiceType)}
                      </p>
                    </div>
                    <div className="text-sm text-text-secondary">
                      {invoice.retainer?.client?.name ??
                        invoice.billToEntity?.name ??
                        "—"}
                    </div>
                    <div className="text-sm text-white tabular-nums">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </div>
                    <div className="text-xs text-text-muted">
                      Issued {formatDate(invoice.issueDate)}
                    </div>
                    <div className="text-xs text-text-muted">
                      Due {formatDate(invoice.dueDate)}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          statusStyles[invoice.status] ?? statusStyles.DRAFT
                        }`}
                      >
                        {invoice.status}
                      </span>
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
