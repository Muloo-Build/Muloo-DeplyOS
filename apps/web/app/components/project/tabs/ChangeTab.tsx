"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { SkeletonRows } from "../../LoadingSkeleton";

interface DeliveryWorkstream {
  id: string;
  name: string;
  estimatedHours?: number | null;
  hourCap?: number | null;
}

interface ChangeTabProject {
  id: string;
  scopeLockedAt?: string | null;
  deliveryWorkstreams?: DeliveryWorkstream[] | null;
}

interface ChangeRequest {
  id: string;
  title: string;
  summary: string;
  status: string;
  commercialImpactHours?: number | null;
  commercialImpactFeeZar?: number | null;
  reason?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  rejectedAt?: string | null;
  deliveryAppendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteTotals {
  totalHumanHours?: number;
  totalFeeZar?: number;
  grandTotalZar?: number;
}

interface QuoteRecord {
  id: string;
  version: number;
  status: string;
  approvedAt?: string | null;
  totals?: QuoteTotals | null;
}

const PENDING_STATUSES = new Set(["new", "under_review"]);
const PRICED_OR_APPROVED_STATUSES = new Set([
  "priced",
  "approved",
  "appended_to_delivery",
  "closed"
]);
const SCOPE_AFFECTING_STATUSES = new Set([
  "approved",
  "appended_to_delivery",
  "closed"
]);
const REJECTED_STATUSES = new Set(["rejected"]);

function formatStatusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusPillClass(status: string) {
  if (status === "priced") {
    return "bg-[rgba(245,196,82,0.16)] text-[#f5d28a]";
  }
  if (SCOPE_AFFECTING_STATUSES.has(status)) {
    return "bg-[rgba(45,212,160,0.16)] text-[#78f0c8]";
  }
  if (REJECTED_STATUSES.has(status)) {
    return "bg-[rgba(224,80,96,0.16)] text-[#ff98a7]";
  }
  return "bg-[rgba(123,226,239,0.12)] text-[#7be2ef]";
}

function formatHours(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toLocaleString("en-ZA")}h`;
}

function formatZar(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatSignedHours(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatHours(Math.abs(value))}`;
}

function formatSignedZar(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatZar(Math.abs(value))}`;
}

export default function ChangeTab({
  projectId,
  project
}: {
  projectId: string;
  project: ChangeTabProject;
}) {
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [baselineQuote, setBaselineQuote] = useState<QuoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setRequests(null);
      setBaselineQuote(null);
      try {
        const [changesResult, quotesResult] = await Promise.allSettled([
          fetch(`/api/projects/${encodeURIComponent(projectId)}/changes`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/quotes`)
        ]);

        if (changesResult.status === "rejected" || !changesResult.value.ok) {
          throw new Error("Failed to load change requests");
        }

        const changesBody = (await changesResult.value.json()) as {
          workRequests?: ChangeRequest[];
        };

        // Quote fetch is best-effort — failure degrades the baseline to the
        // workstream-estimate fallback, but never blocks the change list.
        let quote: QuoteRecord | null = null;
        if (quotesResult.status === "fulfilled" && quotesResult.value.ok) {
          try {
            const quotesBody = (await quotesResult.value.json()) as {
              quotes?: QuoteRecord[];
            };
            const quotes = quotesBody.quotes ?? [];
            // Prefer the most-recently-approved quote (the actual signed-off
            // baseline). Fall back to the latest quote by version so an
            // unapproved-but-shared quote can still seed the diff.
            const approvedSorted = quotes
              .filter((entry) => Boolean(entry.approvedAt))
              .sort((left, right) => {
                const leftAt = new Date(left.approvedAt ?? 0).getTime();
                const rightAt = new Date(right.approvedAt ?? 0).getTime();
                return rightAt - leftAt;
              });
            quote =
              approvedSorted[0] ??
              quotes
                .slice()
                .sort((left, right) => right.version - left.version)[0] ??
              null;
          } catch {
            quote = null;
          }
        }

        if (!cancelled) {
          setRequests(changesBody.workRequests ?? []);
          setBaselineQuote(quote);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRequests([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load change requests"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const grouped = useMemo(() => {
    const list = requests ?? [];
    return {
      pending: list.filter((request) => PENDING_STATUSES.has(request.status)),
      pricedOrApproved: list.filter((request) =>
        PRICED_OR_APPROVED_STATUSES.has(request.status)
      ),
      rejected: list.filter((request) => REJECTED_STATUSES.has(request.status))
    };
  }, [requests]);

  const workstreamEstimateHours = useMemo(() => {
    const workstreams = project.deliveryWorkstreams ?? [];
    return workstreams.reduce(
      (sum, workstream) =>
        sum +
        (typeof workstream.estimatedHours === "number"
          ? workstream.estimatedHours
          : 0),
      0
    );
  }, [project.deliveryWorkstreams]);

  const baseline = useMemo(() => {
    const totals = baselineQuote?.totals ?? null;
    const quoteHours =
      typeof totals?.totalHumanHours === "number"
        ? totals.totalHumanHours
        : null;
    const quoteFee =
      typeof totals?.grandTotalZar === "number"
        ? totals.grandTotalZar
        : typeof totals?.totalFeeZar === "number"
          ? totals.totalFeeZar
          : null;

    if (baselineQuote && (quoteHours !== null || quoteFee !== null)) {
      return {
        source: "quote" as const,
        hours: quoteHours ?? 0,
        fee: quoteFee ?? 0,
        approvedAt: baselineQuote.approvedAt ?? null,
        version: baselineQuote.version
      };
    }

    return {
      source: "workstreams" as const,
      hours: workstreamEstimateHours,
      fee: null as number | null,
      approvedAt: null,
      version: null
    };
  }, [baselineQuote, workstreamEstimateHours]);

  const approvedDelta = useMemo(() => {
    const list = (requests ?? []).filter((request) =>
      SCOPE_AFFECTING_STATUSES.has(request.status)
    );
    const hours = list.reduce(
      (sum, request) =>
        sum +
        (typeof request.commercialImpactHours === "number"
          ? request.commercialImpactHours
          : 0),
      0
    );
    const fee = list.reduce(
      (sum, request) =>
        sum +
        (typeof request.commercialImpactFeeZar === "number"
          ? request.commercialImpactFeeZar
          : 0),
      0
    );
    return { hours, fee };
  }, [requests]);

  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-[14px] border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-text-3">
              Change management
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Scope changes for this project
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-text-2">
              Triage incoming change requests, price them, and capture the
              audit trail of approvals or rejections. Approved changes append
              to delivery; rejected changes carry the reason for the record.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/changes`}
            className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
          >
            Open changes workspace →
          </Link>
        </div>
      </section>

      {error ? (
        <section className="brand-surface rounded-[14px] border p-6">
          <p className="text-sm text-status-error">{error}</p>
        </section>
      ) : null}

      <section className="brand-surface rounded-[14px] border p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">Scope diff</h3>
          <span className="text-xs text-text-3">
            {baseline.source === "quote"
              ? baseline.approvedAt
                ? `Baseline: approved quote v${baseline.version} (${formatDate(baseline.approvedAt)})`
                : `Baseline: latest quote v${baseline.version} (not yet approved)`
              : project.scopeLockedAt
                ? `Baseline: workstream estimates · scope locked ${formatDate(project.scopeLockedAt)}`
                : "Baseline: workstream estimates · scope not yet locked"}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-3">
          Originally signed-off scope vs current scope, with approved
          change-request impact in between.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="brand-surface-soft rounded-[14px] border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Originally signed-off
            </p>
            <p className="mt-2 text-sm text-white">
              {formatHours(baseline.hours)}
              {baseline.fee !== null ? ` · ${formatZar(baseline.fee)}` : ""}
            </p>
          </div>
          <div className="brand-surface-soft rounded-[14px] border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Approved changes
            </p>
            <p className="mt-2 text-sm text-white">
              {loading
                ? "—"
                : `${formatSignedHours(approvedDelta.hours)} · ${formatSignedZar(approvedDelta.fee)}`}
            </p>
          </div>
          <div className="brand-surface-soft rounded-[14px] border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Current scope
            </p>
            <p className="mt-2 text-sm text-white">
              {loading
                ? formatHours(baseline.hours)
                : formatHours(baseline.hours + approvedDelta.hours)}
              {baseline.fee !== null
                ? ` · ${formatZar(baseline.fee + (loading ? 0 : approvedDelta.fee))}`
                : ""}
            </p>
          </div>
        </div>
      </section>

      <ChangeListSection
        title="Pending changes"
        description="Requests captured from the Inbox or raised internally, awaiting triage."
        loading={loading}
        items={grouped.pending}
        emptyText="No pending change requests."
        renderMeta={(request) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(request.status)}`}
          >
            {formatStatusLabel(request.status)}
          </span>
        )}
        renderRight={(request) => (
          <span className="text-xs text-text-3">
            Raised {formatDate(request.createdAt)}
          </span>
        )}
      />

      <ChangeListSection
        title="Priced + approved"
        description="The audit trail of accepted scope changes, with cost deltas."
        loading={loading}
        items={grouped.pricedOrApproved}
        emptyText="No priced or approved changes yet."
        renderMeta={(request) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(request.status)}`}
          >
            {formatStatusLabel(request.status)}
          </span>
        )}
        renderRight={(request) => {
          const hours = request.commercialImpactHours;
          const fee = request.commercialImpactFeeZar;
          const hasHours = typeof hours === "number" && hours !== 0;
          const hasFee = typeof fee === "number" && fee !== 0;
          if (!hasHours && !hasFee) {
            return (
              <span className="text-xs text-text-3">Not priced</span>
            );
          }
          const parts: string[] = [];
          if (hasHours) parts.push(formatSignedHours(hours as number));
          if (hasFee) parts.push(formatSignedZar(fee as number));
          const quoteLine = `${request.title} — ${hasHours ? `${hours}h` : ""}${
            hasHours && hasFee ? " · " : ""
          }${hasFee ? `R${(fee as number).toLocaleString("en-ZA")}` : ""}`;
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-white">{parts.join(" · ")}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void navigator.clipboard.writeText(quoteLine);
                }}
                className="rounded-md border border-ink-4 bg-white/5 px-2 py-0.5 text-[10px] text-text-2 hover:bg-white/10 hover:text-white"
                title="Copy as quote line"
              >
                Copy as quote line
              </button>
            </div>
          );
        }}
        renderFooter={(request) =>
          request.approvedByName || request.approvedAt ? (
            <p className="mt-2 text-xs text-text-3">
              Approved
              {request.approvedByName ? ` by ${request.approvedByName}` : ""}
              {request.approvedAt
                ? ` on ${formatDate(request.approvedAt)}`
                : ""}
              {request.deliveryAppendedAt
                ? ` · Appended to delivery ${formatDate(request.deliveryAppendedAt)}`
                : ""}
            </p>
          ) : null
        }
      />

      <ChangeListSection
        title="Rejected"
        description="Declined requests with the reason on file."
        loading={loading}
        items={grouped.rejected}
        emptyText="No rejected changes."
        renderMeta={(request) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(request.status)}`}
          >
            {formatStatusLabel(request.status)}
          </span>
        )}
        renderRight={(request) => (
          <span className="text-xs text-text-3">
            Rejected {formatDate(request.rejectedAt)}
          </span>
        )}
        renderFooter={(request) =>
          request.reason ? (
            <p className="mt-2 text-xs text-text-2">
              <span className="text-text-3">Reason:</span> {request.reason}
            </p>
          ) : null
        }
      />
    </div>
  );
}

function ChangeListSection({
  title,
  description,
  loading,
  items,
  emptyText,
  renderMeta,
  renderRight,
  renderFooter
}: {
  title: string;
  description: string;
  loading: boolean;
  items: ChangeRequest[];
  emptyText: string;
  renderMeta: (request: ChangeRequest) => ReactNode;
  renderRight: (request: ChangeRequest) => ReactNode;
  renderFooter?: (request: ChangeRequest) => ReactNode;
}) {
  return (
    <section className="brand-surface rounded-[14px] border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          {title}
          {!loading ? ` (${items.length})` : ""}
        </h3>
      </div>
      <p className="mt-1 text-sm text-text-3">{description}</p>
      <div className="mt-4">
        {loading ? (
          <SkeletonRows count={2} />
        ) : items.length === 0 ? (
          <p className="text-sm text-text-2">{emptyText}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((request) => (
              <li
                key={request.id}
                className="brand-surface-soft rounded-[14px] border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {request.title}
                      </p>
                      {renderMeta(request)}
                    </div>
                    {request.summary ? (
                      <p className="mt-1 text-sm text-text-2">
                        {request.summary}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {renderRight(request)}
                  </div>
                </div>
                {renderFooter ? renderFooter(request) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
