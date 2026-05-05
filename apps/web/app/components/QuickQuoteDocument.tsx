"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import AppShell from "./AppShell";
import ClientShell from "./ClientShell";

interface QuoteData {
  id: string;
  projectId: string;
  version: number;
  status: string;
  template: string;
  currency: string;
  defaultRate: number | null;
  hubspotDealId?: string | null;
  productLines: Array<{
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    unitLabel: string;
    unitPrice: number;
    lineTotalZar: number;
    metadata?: {
      discount?: number;
      discountType?: "percent" | "fixed";
    } | null;
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
  sendCount?: number;
  lastSentAt?: string | null;
  lastSentTo?: string[];
}

interface ClientContactRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  title: string | null;
  canApproveQuotes: boolean;
}

interface ProjectInfo {
  id: string;
  name: string;
  scopeType: string | null;
  status: string;
  owner: string;
  ownerEmail: string;
  client: {
    id: string;
    name: string;
    slug: string;
    contacts?: ClientContactRow[];
  } | null;
  clientPortalUserCount?: number;
}

const statusStyles: Record<string, string> = {
  draft: "bg-white/5 text-text-2 border border-ink-4",
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

function deriveQuoteRef(quoteId: string, version: number) {
  const tail = quoteId.slice(-6).toUpperCase();
  return `Q-${tail}-V${version}`;
}

function deriveValidityDate(sharedAt: string) {
  const issued = new Date(sharedAt);
  issued.setDate(issued.getDate() + 30);
  return issued.toISOString();
}

function formatRelativeTime(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
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
    maximumFractionDigits: 2
  }).format(amount);
}

type QuoteMode = "internal" | "client" | "preview";

interface QuickQuoteDocumentProps {
  quoteId: string;
  mode?: QuoteMode;
}

export default function QuickQuoteDocument({
  quoteId,
  mode = "internal"
}: QuickQuoteDocumentProps) {
  const isClient = mode === "client";
  const isPreview = mode === "preview";
  // Both "client" and "preview" should render with the client-facing layout.
  const showClientLayout = isClient || isPreview;
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);

  async function loadQuote() {
    setLoading(true);
    setError(null);
    try {
      // Preview mode uses the internal endpoint (no client auth required)
      // even though it renders with the client-facing layout.
      const url = isClient
        ? `/api/client/quotes/${encodeURIComponent(quoteId)}`
        : `/api/quotes/${encodeURIComponent(quoteId)}`;
      const response = await fetch(url, { credentials: "include" });
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

  async function handleClientApprove() {
    if (!quote) return;
    const confirmed = window.confirm(
      "Approve this quote? Your name and email will be captured on the record."
    );
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/client/quotes/${encodeURIComponent(quote.id)}/approve`,
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
        throw new Error(body?.error ?? "Failed to approve quote");
      }
      setFeedback("Quote approved. We'll be in touch shortly.");
      await loadQuote();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve quote"
      );
    } finally {
      setBusy(false);
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

  async function handleHubspotLink(dealId: string | null) {
    if (!quote) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/quotes/${encodeURIComponent(quote.id)}/hubspot-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dealId })
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { quote?: QuoteData; error?: string }
        | null;
      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to update HubSpot deal link");
      }
      setFeedback(dealId ? "Linked to HubSpot deal" : "HubSpot deal unlinked");
      window.setTimeout(() => setFeedback(null), 2500);
      await loadQuote();
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Failed to update HubSpot deal link"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleHubspotSync() {
    if (!quote) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/quotes/${encodeURIComponent(quote.id)}/hubspot-sync`,
        {
          method: "POST",
          credentials: "include"
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to sync HubSpot deal");
      }
      setFeedback("Pushed to HubSpot deal");
      window.setTimeout(() => setFeedback(null), 2500);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to sync HubSpot deal"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmail(payload: {
    to: string[];
    cc: string[];
    message: string;
  }) {
    if (!quote) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/quotes/${encodeURIComponent(quote.id)}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            to: payload.to,
            cc: payload.cc.length > 0 ? payload.cc : undefined,
            message: payload.message.trim() || undefined
          })
        }
      );
      const body = (await response.json().catch(() => null)) as {
        quote?: QuoteData;
        delivery?: { to: string[]; sentAt: string };
        error?: string;
      } | null;
      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to send quote email");
      }
      setSendModalOpen(false);
      setFeedback(
        body.delivery
          ? `Sent to ${body.delivery.to.join(", ")}`
          : "Quote sent"
      );
      window.setTimeout(() => setFeedback(null), 3500);
      await loadQuote();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send quote email"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePushToPortal(payload: {
    alsoEmail: boolean;
    message: string;
  }) {
    if (!quote) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/quotes/${encodeURIComponent(quote.id)}/push-to-portal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            alsoEmail: payload.alsoEmail,
            message: payload.message.trim() || undefined
          })
        }
      );
      const body = (await response.json().catch(() => null)) as {
        quote?: QuoteData;
        portal?: { portalLink: string; portalUserCount: number };
        delivery?: { to: string[] } | null;
        error?: string;
      } | null;
      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to push quote to portal");
      }
      setPushModalOpen(false);
      const baseLabel = "Pushed to client portal";
      const emailedTail =
        payload.alsoEmail && body.delivery?.to?.length
          ? ` · emailed ${body.delivery.to.join(", ")}`
          : "";
      setFeedback(`${baseLabel}${emailedTail}`);
      window.setTimeout(() => setFeedback(null), 3500);
      await loadQuote();
    } catch (pushError) {
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push quote to portal"
      );
    } finally {
      setBusy(false);
    }
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

  const Shell = showClientLayout ? ClientShell : AppShell;

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-text-2">
          Loading quote...
        </div>
      </Shell>
    );
  }

  if (error || !quote || !project) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl px-6 py-12">
          {!showClientLayout ? (
            <Link
              href="/quotes"
              className="text-sm text-[#49cde1] hover:underline"
            >
              ← Back to quotes
            </Link>
          ) : isPreview ? (
            <Link
              href={`/quotes/${encodeURIComponent(quoteId)}`}
              className="text-sm text-[#49cde1] hover:underline"
            >
              ← Back to internal view
            </Link>
          ) : null}
          <p className="mt-6 rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error ?? "Quote not found"}
          </p>
        </div>
      </Shell>
    );
  }

  const isOnePager = quote.template === "one_pager";
  const showMulooIntro =
    !isOnePager &&
    Boolean(quote.context?.contentOverrides?.approvalSummary);
  const execSummary = quote.context?.quoteContextSummary;
  const terms = quote.context?.contentOverrides?.termsAndWorkingScope;
  const subtotal = quote.totals.grandTotalZar;
  const productLineRows = quote.productLines.map((line) => {
    const discount = line.metadata?.discount ?? 0;
    const discountType: "percent" | "fixed" =
      line.metadata?.discountType ?? "percent";
    const gross = line.quantity * line.unitPrice;
    const net = line.lineTotalZar;
    const discountAmount = Math.max(0, gross - net);
    return { line, discount, discountType, gross, net, discountAmount };
  });
  const subtotalGross = productLineRows.reduce((sum, row) => sum + row.gross, 0);
  const totalLineDiscount = productLineRows.reduce(
    (sum, row) => sum + row.discountAmount,
    0
  );
  const showDiscountSummary = totalLineDiscount > 0;
  const quoteRef = deriveQuoteRef(quote.id, quote.version);
  const validUntil = deriveValidityDate(quote.sharedAt);
  const isApproved = quote.status === "approved" || Boolean(quote.approvedAt);

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        {/* Preview banner */}
        {isPreview ? (
          <div className="document-toolbar flex flex-col gap-2 rounded-[14px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p>
              <span className="font-semibold uppercase tracking-[0.14em] text-amber-200">
                Preview
              </span>{" "}
              <span className="ml-2">
                This is exactly what your client sees. Approve action is
                disabled here.
              </span>
            </p>
            <Link
              href={`/quotes/${encodeURIComponent(quoteId)}`}
              className="text-xs font-medium text-amber-200 underline hover:text-amber-50"
            >
              ← Back to internal view
            </Link>
          </div>
        ) : null}

        {/* Toolbar (hidden in print) */}
        <div className="document-toolbar flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
          {!showClientLayout ? (
            <Link
              href="/quotes"
              className="text-sm font-medium text-[#49cde1] hover:underline"
            >
              ← Back to quotes
            </Link>
          ) : (
            <p className="text-sm text-text-2">
              Quote from {project.owner ?? "Muloo"}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                statusStyles[quote.status] ?? statusStyles.draft
              }`}
            >
              {quote.status}
            </span>

            {!showClientLayout &&
            quote.status !== "archived" &&
            quote.status !== "superseded" ? (
              <Link
                href={`/quotes/new?source=${encodeURIComponent(quote.id)}`}
                className="rounded-xl border border-[#49cde1]/30 bg-[#49cde1]/10 px-3 py-2 text-sm font-medium text-[#9be4f0] transition hover:bg-[#49cde1]/20"
              >
                {quote.status === "draft" ? "Edit" : "Edit & revise"}
              </Link>
            ) : null}

            {!showClientLayout && quote.status === "draft" ? (
              <>
                <button
                  type="button"
                  onClick={() => setPushModalOpen(true)}
                  disabled={busy}
                  className="rounded-xl bg-[#49cde1] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#71dbeb] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Push to portal
                </button>
                <button
                  type="button"
                  onClick={() => setSendModalOpen(true)}
                  disabled={busy}
                  className="rounded-xl border border-[#49cde1]/30 bg-[#49cde1]/10 px-3 py-2 text-xs font-medium text-[#9be4f0] transition hover:bg-[#49cde1]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send via email
                </button>
              </>
            ) : null}

            {!showClientLayout && quote.status === "shared" ? (
              <button
                type="button"
                onClick={handleRecall}
                disabled={busy}
                className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Recall
              </button>
            ) : null}

            {!showClientLayout ? (
              <>
                <Link
                  href={`/quotes/${encodeURIComponent(quote.id)}/preview`}
                  className="rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Preview as client
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    const link = `${window.location.origin}/client/quotes/${quote.id}`;
                    navigator.clipboard.writeText(link).then(
                      () => {
                        setFeedback("Client link copied");
                        window.setTimeout(() => setFeedback(null), 2500);
                      },
                      () => {
                        setError("Unable to copy link");
                        window.setTimeout(() => setError(null), 2500);
                      }
                    );
                  }}
                  className="rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Copy client link
                </button>
              </>
            ) : null}

            {!showClientLayout ? (
              <>
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
                  className="rounded-xl border border-ink-4 bg-white/5 px-3 py-2 text-sm font-medium text-text-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Archive
                </button>
              </>
            ) : null}

            {showClientLayout &&
            quote.status !== "approved" &&
            quote.status !== "won" &&
            quote.status !== "lost" &&
            quote.status !== "archived" &&
            quote.status !== "superseded" ? (
              <button
                type="button"
                onClick={isClient ? handleClientApprove : undefined}
                disabled={busy || isPreview}
                title={isPreview ? "Disabled in preview" : undefined}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Approving..."
                  : isPreview
                    ? "Approve quote (disabled in preview)"
                    : "Approve quote"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2 text-sm font-medium text-white"
            >
              Save PDF
            </button>
          </div>
        </div>

        {!showClientLayout &&
        quote.lastSentAt &&
        (quote.lastSentTo?.length ?? 0) > 0 ? (
          <p className="text-xs text-text-3 print:hidden">
            Sent to {(quote.lastSentTo ?? []).join(", ")} ·{" "}
            {formatRelativeTime(quote.lastSentAt)}
            {(quote.sendCount ?? 0) > 1
              ? ` · ${quote.sendCount} sends total`
              : ""}
          </p>
        ) : null}

        {feedback ? (
          <p className="rounded-[14px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 print:hidden">
            {feedback}
          </p>
        ) : null}

        {!showClientLayout ? (
          <div className="document-toolbar flex flex-col gap-3 rounded-[14px] border border-ink-4 bg-ink-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-bold text-orange-300">
                HS
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                  HubSpot deal sync
                </p>
                <p className="mt-0.5 text-sm text-white">
                  {quote.hubspotDealId ? (
                    <>Linked to deal <span className="font-mono">{quote.hubspotDealId}</span></>
                  ) : (
                    "Not linked. Push status changes into a HubSpot deal."
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="HubSpot deal ID"
                defaultValue={quote.hubspotDealId ?? ""}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next === (quote.hubspotDealId ?? "")) return;
                  void handleHubspotLink(next || null);
                }}
                className="w-44 rounded-xl border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={handleHubspotSync}
                disabled={busy || !quote.hubspotDealId}
                className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sync now
              </button>
            </div>
          </div>
        ) : null}

        {/* Document */}
        <article
          className={`document-content flex flex-col ${isOnePager ? "gap-4" : "gap-6"}`}
        >
          {/* Hero header */}
          <header
            className={`document-card overflow-hidden rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "" : ""}`}
          >
            {!isOnePager ? (
              // Full theme: dramatic gradient strip with brand colour wash
              <div className="border-b border-ink-4 bg-[linear-gradient(135deg,rgba(124,92,191,0.16)_0%,rgba(224,82,156,0.12)_55%,rgba(240,130,74,0.14)_100%)] px-8 py-7 print:bg-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/muloo-logo.svg"
                      alt="Muloo"
                      className="h-10 w-auto"
                    />
                    <span className="text-[11px] uppercase tracking-[0.36em] text-white/80">
                      Commercial proposal
                    </span>
                  </div>
                  <span className="rounded-full border border-ink-5 bg-ink-0/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-text-3 print:border-slate-300 print:text-slate-500">
                    {quoteRef}
                  </span>
                </div>
              </div>
            ) : (
              // One-pager: flat, tight, minimal chrome
              <div className="border-b border-white/5 px-8 py-5 print:bg-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/muloo-logo.svg"
                      alt="Muloo"
                      className="h-7 w-auto"
                    />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                      Quote
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                    {quoteRef}
                  </span>
                </div>
              </div>
            )}

            <div className={isOnePager ? "px-8 py-5" : "px-8 py-8"}>
              <h1
                className={`font-semibold leading-tight tracking-tight text-white print:text-slate-900 ${isOnePager ? "text-[1.5rem] print:text-[1.35rem]" : "text-[2.25rem] print:text-[1.75rem]"}`}
              >
                {quote.context?.quoteTitle ?? project.name}
              </h1>
              {!isOnePager ? (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text-2">
                  Prepared by Muloo for {project.client?.name ?? "your team"}.
                  This proposal sets out the scope, pricing and terms for the
                  engagement.
                </p>
              ) : null}

              <div className="mt-6 grid gap-5 md:grid-cols-[2fr_1fr]">
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                    Prepared for
                  </dt>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                    Prepared by
                  </dt>
                  <dd className="text-white">
                    {project.client?.name ?? "—"}
                  </dd>
                  <dd className="text-white">
                    {project.owner ?? "Muloo"}
                    {project.ownerEmail ? (
                      <span className="block text-xs text-text-3">
                        {project.ownerEmail}
                      </span>
                    ) : null}
                  </dd>

                  <dt className="mt-2 text-[11px] uppercase tracking-[0.14em] text-text-3">
                    Issued
                  </dt>
                  <dt className="mt-2 text-[11px] uppercase tracking-[0.14em] text-text-3">
                    Valid until
                  </dt>
                  <dd className="text-text-2">
                    {formatDate(quote.sharedAt)}
                  </dd>
                  <dd className="text-text-2">
                    {formatDate(validUntil)}
                  </dd>
                </dl>

                <div className="self-start rounded-[14px] border border-[#51d0b0]/30 bg-[linear-gradient(135deg,rgba(81,208,176,0.12)_0%,rgba(73,205,225,0.08)_100%)] px-5 py-4 print:border-slate-300 print:bg-white">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 print:text-slate-500">
                    Total
                  </p>
                  <p className="mt-2 text-[1.75rem] font-semibold leading-tight text-white print:text-slate-900">
                    {formatMoney(subtotal, quote.currency)}
                  </p>
                  <p className="mt-1 text-xs text-text-3 print:text-slate-500">
                    {quote.currency} · v{quote.version}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Muloo intro — full theme only */}
          {showMulooIntro ? (
            <section className="document-card rounded-[14px] border border-ink-4 bg-ink-1 p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
                Who is Muloo
              </p>
              <p className="mt-4 text-[15px] leading-8 text-text-2">
                {quote.context?.contentOverrides?.approvalSummary}
              </p>
            </section>
          ) : null}

          {/* Executive summary */}
          {execSummary ? (
            <section
              className={`document-card rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "p-6" : "p-7"}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
                Executive summary
              </p>
              {!isOnePager ? (
                <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-white print:text-slate-900">
                  Why we're doing this
                </h2>
              ) : null}
              <p
                className={`whitespace-pre-line leading-7 text-text-2 ${isOnePager ? "mt-3 text-sm" : "mt-4 text-[15px] leading-8"}`}
              >
                {execSummary}
              </p>
            </section>
          ) : null}

          {/* Line items */}
          <section
            className={`document-card rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "p-6" : "p-7"}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
              Scope and pricing
            </p>
            <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-white print:text-slate-900">
              Investment
            </h2>

            <div className="mt-5 overflow-hidden rounded-xl border border-ink-4">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-[10px] uppercase tracking-[0.14em] text-text-3 print:bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Term</th>
                    <th className="px-4 py-3 text-right font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Rate / hr</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {productLineRows.map((row) => {
                    const { line, discount, discountType, gross, net, discountAmount } =
                      row;
                    const hasDiscount = discountAmount > 0;
                    return (
                      <tr
                        key={line.id}
                        className="text-text-2 transition hover:bg-white/[0.02] print:hover:bg-transparent"
                      >
                        <td className="px-4 py-4 align-top text-white">
                          <p className="font-medium leading-snug">
                            {line.description || line.name}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right align-top tabular-nums">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-4 text-right align-top tabular-nums">
                          {formatMoney(line.unitPrice, quote.currency)}
                        </td>
                        <td className="px-4 py-4 text-right align-top tabular-nums">
                          {hasDiscount ? (
                            <div className="space-y-1">
                              <p className="text-text-3 line-through">
                                {formatMoney(gross, quote.currency)}
                              </p>
                              <p className="text-emerald-300 print:text-emerald-700">
                                -{formatMoney(discountAmount, quote.currency)}
                                {discountType === "percent"
                                  ? ` (${discount}%)`
                                  : ""}
                              </p>
                              <p className="font-semibold text-white print:text-slate-900">
                                {formatMoney(net, quote.currency)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-white">
                              {formatMoney(net, quote.currency)}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {showDiscountSummary ? (
                    <>
                      <tr className="border-t border-ink-4">
                        <td
                          colSpan={3}
                          className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3 print:text-slate-500"
                        >
                          Subtotal
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-text-2 print:text-slate-700">
                          {formatMoney(subtotalGross, quote.currency)}
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3 print:text-slate-500"
                        >
                          Discount
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-emerald-300 print:text-emerald-700">
                          -{formatMoney(totalLineDiscount, quote.currency)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  <tr className="border-t-2 border-ink-4 bg-[linear-gradient(135deg,rgba(81,208,176,0.06)_0%,rgba(73,205,225,0.04)_100%)] print:bg-slate-50">
                    <td
                      colSpan={3}
                      className="px-4 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3 print:text-slate-500"
                    >
                      Total (excl. VAT)
                    </td>
                    <td className="px-4 py-4 text-right text-lg font-semibold tabular-nums text-white print:text-slate-900">
                      {formatMoney(subtotal, quote.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-3 text-right text-xs text-text-3">
              All amounts shown exclude VAT.
            </p>
          </section>

          {/* Payment schedule */}
          {quote.paymentSchedule.length > 0 ? (
            <section
              className={`document-card rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "p-6" : "p-7"}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
                Payment schedule
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-text-2">
                {quote.paymentSchedule.map((line, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-text-3">{idx + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Terms */}
          {terms ? (
            <section
              className={`document-card rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "p-6" : "p-7"}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
                Terms
              </p>
              <p
                className={`whitespace-pre-line leading-7 text-text-2 ${isOnePager ? "mt-3 text-sm" : "mt-4 text-[15px] leading-8"}`}
              >
                {terms}
              </p>
            </section>
          ) : null}

          {/* Sign-off */}
          <section
            className={`document-card rounded-[14px] border border-ink-4 bg-ink-1 ${isOnePager ? "p-6" : "p-7"}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#49cde1]">
              Approval
            </p>
            <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-white print:text-slate-900">
              {isApproved ? "Approved" : "Approve this quote"}
            </h2>

            {isApproved ? (
              <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5 print:border-emerald-300 print:bg-emerald-50">
                <p className="text-sm font-semibold text-emerald-100 print:text-emerald-900">
                  Quote approved
                </p>
                {quote.approvedAt ? (
                  <p className="mt-1 text-sm text-emerald-200/90 print:text-emerald-800">
                    Signed on {formatDate(quote.approvedAt)}
                  </p>
                ) : null}
              </div>
            ) : showClientLayout ? (
              <>
                <p className="mt-3 text-sm leading-7 text-text-2">
                  By approving, you confirm the scope, pricing and terms above.
                  Your name, email and timestamp will be captured on the
                  record.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={isClient ? handleClientApprove : undefined}
                    disabled={busy || isPreview}
                    title={isPreview ? "Disabled in preview" : undefined}
                    className="inline-flex items-center justify-center rounded-xl bg-[#51d0b0] px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
                  >
                    {busy
                      ? "Approving..."
                      : isPreview
                        ? "Approve this quote (disabled in preview)"
                        : "Approve this quote"}
                  </button>
                  <p className="text-xs text-text-3">
                    Questions before approving?{" "}
                    <a
                      href={`mailto:${project.ownerEmail ?? "hello@muloo.co"}`}
                      className="text-[#49cde1] hover:underline"
                    >
                      Reach out to {project.owner ?? "us"}
                    </a>
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-7 text-text-2">
                  Reply to this quote, or sign below. Approval is captured by
                  name, email and timestamp.
                </p>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                      Signed
                    </p>
                    <div className="mt-3 h-12 border-b border-white/15 print:border-slate-300" />
                    <p className="mt-2 text-xs text-text-3">Name</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                      Date
                    </p>
                    <div className="mt-3 h-12 border-b border-white/15 print:border-slate-300" />
                    <p className="mt-2 text-xs text-text-3">DD MMM YYYY</p>
                  </div>
                </div>
              </>
            )}

            {quote.closedAt ? (
              <p className="mt-4 text-xs text-text-3">
                Closed on {formatDate(quote.closedAt)}
                {quote.closedReason ? ` · ${quote.closedReason}` : ""}
              </p>
            ) : null}
          </section>

          {/* Footer */}
          <footer className="document-card mt-2 flex flex-col gap-2 rounded-[14px] border border-white/5 bg-transparent px-4 py-3 text-[11px] text-text-3 md:flex-row md:items-center md:justify-between print:border-transparent">
            <span>
              {quoteRef} · Issued {formatDate(quote.sharedAt)} · Valid until{" "}
              {formatDate(validUntil)}
            </span>
            <span>
              Questions about this quote?{" "}
              <a
                href={`mailto:${project.ownerEmail ?? "hello@muloo.co"}`}
                className="text-text-2 hover:underline"
              >
                {project.ownerEmail ?? "hello@muloo.co"}
              </a>
            </span>
          </footer>
        </article>
      </div>

      {sendModalOpen ? (
        <SendQuoteEmailModal
          quoteRef={quoteRef}
          clientName={project.client?.name ?? null}
          contacts={project.client?.contacts ?? []}
          busy={busy}
          onClose={() => setSendModalOpen(false)}
          onSend={handleSendEmail}
        />
      ) : null}

      {pushModalOpen ? (
        <PushToPortalModal
          quoteRef={quoteRef}
          clientName={project.client?.name ?? null}
          portalUserCount={project.clientPortalUserCount ?? 0}
          approverContactCount={
            (project.client?.contacts ?? []).filter(
              (contact) => contact.canApproveQuotes && contact.email.trim()
            ).length
          }
          busy={busy}
          onClose={() => setPushModalOpen(false)}
          onPush={handlePushToPortal}
        />
      ) : null}

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 18mm 16mm 22mm 16mm;
          }

          /* Print on clean white paper. The dark share view doesn't read
             well on paper or in PDF viewers — switch to a high-contrast
             commercial-document style instead. */
          html,
          body,
          *,
          *::before,
          *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-shadow: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: -apple-system, "Helvetica Neue", Helvetica, Arial,
              sans-serif;
            font-size: 10pt;
            line-height: 1.55;
          }

          /* Hide every interactive surface so the printed page is a
             pure document. */
          .document-toolbar,
          .sidebar,
          nav,
          aside,
          .print\\:hidden,
          button,
          .preview-banner,
          a[href^="/quotes"],
          a[href^="/projects/"] {
            display: none !important;
          }

          main {
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* Reset every container background to white so the dark theme
             of the share view doesn't carry through. */
          .document-content,
          .document-content * {
            background: transparent !important;
            color: #0f172a !important;
            border-color: #d4d4d8 !important;
          }

          .document-content {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Brand header band — muloo gradient strip at the top of page 1
             only. Other pages get the running header via @page rules. */
          .document-content .quote-header,
          .document-card.quote-header {
            background: linear-gradient(
              135deg,
              #7c5cbf 0%,
              #e0529c 55%,
              #f0824a 100%
            ) !important;
            color: #ffffff !important;
            padding: 18pt 16pt !important;
            border-radius: 0 !important;
            margin-bottom: 18pt !important;
          }
          .document-content .quote-header *,
          .document-card.quote-header * {
            color: #ffffff !important;
            background: transparent !important;
          }

          /* Card layout for paper. Keep modest borders + airy spacing. */
          .document-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d4d4d8 !important;
            border-radius: 6px !important;
            padding: 12pt 14pt !important;
            margin-bottom: 14pt !important;
          }

          .document-content h1 {
            font-size: 22pt;
            font-weight: 700;
            margin: 0 0 4pt 0;
            color: #0f172a !important;
          }
          .document-content h2 {
            font-size: 13pt;
            font-weight: 700;
            margin: 14pt 0 6pt 0;
            page-break-after: avoid;
            color: #0f172a !important;
          }
          .document-content h3 {
            font-size: 11pt;
            font-weight: 600;
            margin: 10pt 0 4pt 0;
            page-break-after: avoid;
            color: #0f172a !important;
          }
          .document-content p {
            margin: 0 0 6pt 0;
          }

          /* Section eyebrows like "EXECUTIVE SUMMARY" — keep accent color
             so they read as section markers rather than body text. */
          .document-content .text-\\[\\#49cde1\\],
          .document-content [class*="text-cyan"],
          .document-content .uppercase.tracking-\\[0\\.25em\\] {
            color: #1d8fae !important;
            font-weight: 600;
            letter-spacing: 0.18em;
            font-size: 8pt;
          }

          /* Tables — readable on paper, with banded headers and clear
             vertical rhythm. */
          .document-content table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
            font-size: 9.5pt;
          }
          .document-content thead {
            display: table-header-group;
          }
          .document-content th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            text-align: left;
            font-weight: 600;
            font-size: 8.5pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 6pt 8pt;
            border-bottom: 1px solid #cbd5e1 !important;
          }
          .document-content td {
            padding: 8pt;
            border-bottom: 1px solid #e2e8f0 !important;
            vertical-align: top;
          }
          .document-content tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          /* Total row — emphasise the bottom-line figure. */
          .document-content .quote-total-row td,
          .document-content tfoot td {
            font-weight: 700;
            font-size: 10.5pt;
            border-top: 2px solid #0f172a !important;
            border-bottom: none !important;
            padding-top: 10pt;
          }

          /* Approval signature block — leave clear space for a wet
             signature when printed. */
          .document-content .quote-signature-block {
            border-top: 1px solid #94a3b8 !important;
            padding-top: 10pt;
            margin-top: 18pt;
          }

          /* Page footer with reference + page numbers via CSS counters. */
          @page {
            @bottom-left {
              content: "Muloo Deploy OS";
              font-size: 8pt;
              color: #64748b;
            }
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 8pt;
              color: #64748b;
            }
          }
        }
      `}</style>
    </Shell>
  );
}

interface SendQuoteEmailModalProps {
  quoteRef: string;
  clientName: string | null;
  contacts: ClientContactRow[];
  busy: boolean;
  onClose: () => void;
  onSend: (payload: {
    to: string[];
    cc: string[];
    message: string;
  }) => Promise<void>;
}

function SendQuoteEmailModal({
  quoteRef,
  clientName,
  contacts,
  busy,
  onClose,
  onSend
}: SendQuoteEmailModalProps) {
  const defaultRecipients = contacts
    .filter((contact) => contact.canApproveQuotes && contact.email.trim())
    .map((contact) => contact.email.trim().toLowerCase());

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultRecipients)
  );
  const [extraTo, setExtraTo] = useState("");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const filteredContacts = contacts.filter((contact) => {
    if (!filter.trim()) return true;
    const term = filter.trim().toLowerCase();
    const haystack = [
      contact.firstName,
      contact.lastName ?? "",
      contact.email,
      contact.title ?? ""
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  function toggleContact(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  }

  function parseAddresses(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fromContacts = Array.from(selected);
    const fromExtra = parseAddresses(extraTo).map((entry) =>
      entry.toLowerCase()
    );
    const to = Array.from(new Set([...fromContacts, ...fromExtra]));
    const ccList = parseAddresses(cc).map((entry) => entry.toLowerCase());

    if (to.length === 0) {
      setLocalError("Pick at least one recipient");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = [...to, ...ccList].find((entry) => !emailRegex.test(entry));
    if (invalid) {
      setLocalError(`"${invalid}" is not a valid email address`);
      return;
    }

    setLocalError(null);
    void onSend({ to, cc: ccList, message });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,18,0.84)] px-4">
      <div className="flex w-full max-w-2xl flex-col rounded-[28px] border border-ink-4 bg-[#111933] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Send via email
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {quoteRef}
              {clientName ? (
                <span className="text-text-3"> · {clientName}</span>
              ) : null}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-ink-4 px-3 py-2 text-sm text-text-2 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Client contacts
            </p>
            {contacts.length === 0 ? (
              <p className="mt-2 rounded-xl border border-ink-4 bg-ink-1 px-3 py-3 text-sm text-text-2">
                No contacts on file for this client. Use the override field
                below to send to a specific email.
              </p>
            ) : (
              <>
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter contacts"
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm text-white outline-none"
                />
                <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-ink-4 bg-ink-1">
                  {filteredContacts.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-text-2">
                      No contacts match that filter.
                    </li>
                  ) : (
                    filteredContacts.map((contact) => {
                      const normalized = contact.email.trim().toLowerCase();
                      const checked = selected.has(normalized);
                      return (
                        <li key={contact.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleContact(contact.email)}
                            />
                            <div className="flex-1 text-sm text-white">
                              <div className="flex items-center gap-2">
                                <span>
                                  {contact.firstName}
                                  {contact.lastName ? ` ${contact.lastName}` : ""}
                                </span>
                                {contact.canApproveQuotes ? (
                                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
                                    Approver
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-text-3">
                                {contact.email}
                                {contact.title ? ` · ${contact.title}` : ""}
                              </div>
                            </div>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-text-3">
              Additional recipients (To)
            </span>
            <input
              type="text"
              value={extraTo}
              onChange={(event) => setExtraTo(event.target.value)}
              placeholder="comma-separated emails"
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-text-3">
              Cc
            </span>
            <input
              type="text"
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="comma-separated emails"
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-text-3">
              Custom message (optional)
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Defaults will be appended automatically — quote total, validity, and a portal link."
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm text-white outline-none"
            />
          </label>

          {localError ? (
            <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {localError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-ink-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-ink-4 px-4 py-2 text-sm text-text-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#49cde1] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#71dbeb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending..." : "Send quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PushToPortalModalProps {
  quoteRef: string;
  clientName: string | null;
  portalUserCount: number;
  approverContactCount: number;
  busy: boolean;
  onClose: () => void;
  onPush: (payload: { alsoEmail: boolean; message: string }) => Promise<void>;
}

function PushToPortalModal({
  quoteRef,
  clientName,
  portalUserCount,
  approverContactCount,
  busy,
  onClose,
  onPush
}: PushToPortalModalProps) {
  const [message, setMessage] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(portalUserCount === 0);
  const emailDisabled = approverContactCount === 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void onPush({
      alsoEmail: alsoEmail && !emailDisabled,
      message
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,18,0.84)] px-4">
      <div className="flex w-full max-w-xl flex-col rounded-[28px] border border-ink-4 bg-[#111933] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Push to portal
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {quoteRef}
              {clientName ? (
                <span className="text-text-3"> · {clientName}</span>
              ) : null}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-ink-4 px-3 py-2 text-sm text-text-2 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <p className="text-sm text-text-2">
            {portalUserCount > 0
              ? `Notifies ${portalUserCount} portal user${portalUserCount === 1 ? "" : "s"} on this project. Quote flips to Sent.`
              : "No portal users on this project yet. We'll fall back to email."}
          </p>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.14em] text-text-3">
              Message to client (optional)
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Adds a short note above the portal link."
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-1 px-3 py-2 text-sm text-white outline-none"
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-ink-4 bg-ink-1 px-3 py-3">
            <input
              type="checkbox"
              checked={alsoEmail && !emailDisabled}
              disabled={emailDisabled}
              onChange={(event) => setAlsoEmail(event.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1 text-sm">
              <div className="font-medium text-white">
                Also send email
              </div>
              <div className="mt-1 text-xs text-text-3">
                {emailDisabled
                  ? "No approver contacts on file — add an approver to enable email."
                  : `Sends to ${approverContactCount} approver contact${approverContactCount === 1 ? "" : "s"}.`}
              </div>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-ink-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-ink-4 px-4 py-2 text-sm text-text-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#49cde1] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#71dbeb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Pushing..." : "Push to portal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
