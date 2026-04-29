"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface QuoteData {
  id: string;
  projectId: string;
  version: number;
  status: string;
  template: string;
  currency: string;
  defaultRate: number | null;
  productLines: Array<{
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    unitLabel: string;
    unitPrice: number;
    lineTotalZar: number;
    metadata?: { discount?: number } | null;
  }>;
  totals: {
    grandTotalZar: number;
    additionalProductsTotalZar: number;
    paymentAmountZar: number;
  };
  paymentSchedule: string[];
  context: {
    quoteTitle?: string | null;
    quoteContextSummary: string | null;
    isStandaloneQuote: boolean;
    contentOverrides?: {
      termsAndWorkingScope?: string | null;
      approvalSummary?: string | null;
    } | null;
  } | null;
  sharedAt: string;
  approvedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
}

interface ProjectInfo {
  id: string;
  name: string;
  scopeType: string | null;
  client: { id: string; name: string; slug: string } | null;
}

const statusStyles: Record<string, string> = {
  draft: "bg-white/5 text-text-secondary border border-white/10",
  shared: "bg-[#49cde1]/15 text-[#9be4f0] border border-[#49cde1]/30",
  approved: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
  won: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  lost: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
  archived: "bg-slate-500/15 text-slate-300 border border-slate-400/30"
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export default function QuickQuoteDocument({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadQuote() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}`, {
        credentials: "include"
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load quote");
      }
      const body = (await response.json()) as {
        quote: QuoteData;
        project: ProjectInfo;
      };
      setQuote(body.quote);
      setProject(body.project);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load quote"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuote();
  }, [quoteId]);

  async function applyMeta(update: {
    status?: string;
    closedReason?: string;
  }) {
    if (!quote) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(quote.projectId)}/quote/meta`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(update)
        }
      );
      const body = (await response.json().catch(() => null)) as {
        quote?: QuoteData;
        error?: string;
      } | null;
      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to update quote");
      }
      const labels: Record<string, string> = {
        won: "Marked as won",
        lost: "Marked as lost",
        archived: "Archived",
        shared: "Reopened",
        draft: "Reverted to draft"
      };
      setFeedback(labels[update.status ?? ""] ?? "Quote updated");
      window.setTimeout(() => setFeedback(null), 2500);
      await loadQuote();
    } catch (metaError) {
      setError(
        metaError instanceof Error
          ? metaError.message
          : "Failed to update quote"
      );
    } finally {
      setBusy(false);
    }
  }

  async function markAs(targetStatus: "won" | "lost" | "archived") {
    const promptLabel =
      targetStatus === "won"
        ? "Optional note on the win"
        : targetStatus === "lost"
          ? "Optional reason for losing"
          : "Optional archive note";
    const reason = window.prompt(promptLabel) ?? "";
    await applyMeta({ status: targetStatus, closedReason: reason || undefined });
  }

  async function handleRecall() {
    if (!quote) return;
    const confirmed = window.confirm(
      "Recall this quote? It will move back to draft and no longer be considered sent. The version number stays the same."
    );
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/quotes/${encodeURIComponent(quote.id)}/recall`,
        {
          method: "POST",
          credentials: "include"
        }
      );
      const body = (await response.json().catch(() => null)) as {
        quote?: QuoteData;
        error?: string;
      } | null;
      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to recall quote");
      }
      setFeedback("Quote recalled. Status reverted to draft.");
      window.setTimeout(() => setFeedback(null), 2500);
      await loadQuote();
    } catch (recallError) {
      setError(
        recallError instanceof Error
          ? recallError.message
          : "Failed to recall quote"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-text-secondary">
          Loading quote...
        </div>
      </AppShell>
    );
  }

  if (error || !quote || !project) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Link href="/quotes" className="text-sm text-[#49cde1] hover:underline">
            ← Back to quotes
          </Link>
          <p className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error ?? "Quote not found"}
          </p>
        </div>
      </AppShell>
    );
  }

  const showMulooIntro = Boolean(
    quote.context?.contentOverrides?.approvalSummary
  );
  const execSummary = quote.context?.quoteContextSummary;
  const terms = quote.context?.contentOverrides?.termsAndWorkingScope;
  const subtotal = quote.totals.grandTotalZar;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        {/* Toolbar (hidden in print) */}
        <div className="document-toolbar flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
          <Link
            href="/quotes"
            className="text-sm font-medium text-[#49cde1] hover:underline"
          >
            ← Back to quotes
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                statusStyles[quote.status] ?? statusStyles.draft
              }`}
            >
              {quote.status}
            </span>
            {quote.status !== "archived" &&
            quote.status !== "superseded" ? (
              <Link
                href={`/quotes/new?source=${encodeURIComponent(quote.id)}`}
                className="rounded-xl border border-[#49cde1]/30 bg-[#49cde1]/10 px-3 py-2 text-sm font-medium text-[#9be4f0] transition hover:bg-[#49cde1]/20"
              >
                {quote.status === "draft" ? "Edit" : "Edit & revise"}
              </Link>
            ) : null}
            {quote.status === "shared" ? (
              <button
                type="button"
                onClick={handleRecall}
                disabled={busy}
                className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Recall
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => markAs("won")}
              disabled={busy || quote.status === "won"}
              className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Won
            </button>
            <button
              type="button"
              onClick={() => markAs("lost")}
              disabled={busy || quote.status === "lost"}
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Lost
            </button>
            <button
              type="button"
              onClick={() => markAs("archived")}
              disabled={busy || quote.status === "archived"}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2 text-sm font-medium text-white"
            >
              Save PDF
            </button>
          </div>
        </div>

        {feedback ? (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 print:hidden">
            {feedback}
          </p>
        ) : null}

        {/* Document */}
        <article className="document-content flex flex-col gap-6">
          {/* Header card */}
          <header className="document-card rounded-2xl border border-white/10 bg-background-card p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <img
                    src="/muloo-logo.svg"
                    alt="Muloo"
                    className="h-8 w-auto"
                  />
                  <span className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
                    Quote
                  </span>
                </div>
                <h1 className="mt-6 text-[1.875rem] font-semibold leading-tight tracking-tight text-white print:text-[1.5rem] print:text-slate-900">
                  {quote.context?.quoteTitle ?? project.name}
                </h1>
                <p className="mt-2 text-sm text-text-secondary">
                  Prepared for {project.client?.name ?? "client"} ·{" "}
                  {formatDate(quote.sharedAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background-primary/60 px-5 py-4 text-sm">
                <p className="text-[10px] uppercase tracking-[0.32em] text-text-muted">
                  Total
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatMoney(subtotal, quote.currency)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {quote.currency} · v{quote.version}
                </p>
              </div>
            </div>
          </header>

          {/* Muloo intro */}
          {showMulooIntro ? (
            <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
                Who is Muloo
              </p>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                {quote.context?.contentOverrides?.approvalSummary}
              </p>
            </section>
          ) : null}

          {/* Executive summary */}
          {execSummary ? (
            <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
                Executive summary
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary">
                {execSummary}
              </p>
            </section>
          ) : null}

          {/* Line items */}
          <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
              Scope and pricing
            </p>
            <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-white print:text-slate-900">
              Line items
            </h2>

            <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 text-right font-medium">Rate</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {quote.productLines.map((line) => (
                    <tr key={line.id} className="text-text-secondary">
                      <td className="px-4 py-3 align-top text-white">
                        <p className="font-medium">
                          {line.description || line.name}
                        </p>
                        {line.metadata?.discount &&
                        line.metadata.discount > 0 ? (
                          <p className="mt-1 text-[11px] text-text-muted">
                            {line.metadata.discount}% discount applied
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 align-top">{line.unitLabel}</td>
                      <td className="px-4 py-3 text-right align-top">
                        {formatMoney(line.unitPrice, quote.currency)}
                      </td>
                      <td className="px-4 py-3 text-right align-top text-white">
                        {formatMoney(line.lineTotalZar, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.03]">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm text-text-secondary">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold text-white">
                      {formatMoney(subtotal, quote.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Payment schedule */}
          {quote.paymentSchedule.length > 0 ? (
            <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
                Payment schedule
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-text-secondary">
                {quote.paymentSchedule.map((line, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-text-muted">{idx + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Terms */}
          {terms ? (
            <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
                Terms
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary">
                {terms}
              </p>
            </section>
          ) : null}

          {/* Sign-off */}
          <section className="document-card rounded-2xl border border-white/10 bg-background-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#49cde1]">
              Approval
            </p>
            <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-white print:text-slate-900">
              Ready to proceed?
            </h2>
            {quote.status === "approved" || quote.approvedAt ? (
              <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">Approved</p>
                <p className="mt-1">
                  {quote.approvedAt
                    ? `On ${formatDate(quote.approvedAt)}`
                    : null}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-background-primary/40 p-4">
                <p className="text-sm text-text-secondary">
                  Reply to this quote to approve. Approval is captured by name,
                  email and timestamp on the client portal.
                </p>
              </div>
            )}
            {quote.closedAt ? (
              <p className="mt-3 text-xs text-text-muted">
                Closed on {formatDate(quote.closedAt)}
                {quote.closedReason ? ` · ${quote.closedReason}` : ""}
              </p>
            ) : null}
          </section>
        </article>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 18mm 16mm;
          }

          .document-toolbar,
          .sidebar,
          nav,
          aside {
            display: none !important;
          }

          main {
            padding-left: 0 !important;
          }

          body,
          html {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .document-content {
            color: #0f172a !important;
            font-size: 10.5pt;
            line-height: 1.55;
          }

          .document-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            margin-bottom: 12pt;
          }

          .document-card *,
          .document-content h1,
          .document-content h2,
          .document-content p,
          .document-content li,
          .document-content span,
          .document-content td,
          .document-content th {
            color: #0f172a !important;
          }

          .document-content table {
            page-break-inside: auto;
          }

          .document-content tr {
            page-break-inside: avoid;
          }

          .document-content th {
            font-size: 9pt;
            color: #64748b !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
