"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";

interface ClientRetainerDetail {
  id: string;
  name: string;
  serviceLine: string;
  blockSize: number;
  rate: number;
  currency: string;
  startDate: string;
  endDate: string | null;
  status: string;
  billToEntity: {
    id: string;
    name: string;
    type: "CLIENT" | "PARTNER_AGENCY";
  };
  currentPeriod: {
    id: string;
    periodMonth: string;
    blockHours: number;
    rolledInHours: number;
    borrowedFromNext: number;
    consumedHours: number;
    overageHours: number;
    rolledOutHours: number;
    approvedTopUpHours: number;
    totalAvailable: number;
    remainingHours: number;
    daysUntilRefresh: number;
    topUps: Array<{
      id: string;
      hours: number;
      rate: number;
      status: string;
      quotedAt: string;
      approvedAt: string | null;
      total: number;
    }>;
  } | null;
  rolloverBuckets: Array<{
    id: string;
    earnMonth: string;
    expiresAt: string;
    hoursRemaining: number;
  }>;
  visibleInvoices: Array<{
    id: string;
    reference: string;
    amount: number;
    currency: string;
    issueDate: string;
    dueDate: string;
    xeroUrl: string | null;
    status: string;
  }>;
}

interface ClientRetainerHistoryResponse {
  periods: Array<{
    id: string;
    periodMonth: string;
    blockHours: number;
    rolledInHours: number;
    borrowedFromNext: number;
    consumedHours: number;
    approvedTopUpHours: number;
    overageHours: number;
    rolledOutHours: number;
    balance: number;
    status: string;
    topUps: Array<{
      id: string;
      hours: number;
      rate: number;
      status: string;
      total: number;
    }>;
  }>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatServiceLine(value: string) {
  return value === "TECHNICAL_DELIVERY" ? "Technical Delivery" : "Consulting";
}

export default function ClientRetainerWorkspace({
  retainerId
}: {
  retainerId: string;
}) {
  const [retainer, setRetainer] = useState<ClientRetainerDetail | null>(null);
  const [history, setHistory] = useState<ClientRetainerHistoryResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRetainer() {
      try {
        const [detailResponse, historyResponse] = await Promise.all([
          fetch(`/api/client/retainers/${encodeURIComponent(retainerId)}`, {
            credentials: "include"
          }),
          fetch(`/api/client/retainers/${encodeURIComponent(retainerId)}/history`, {
            credentials: "include"
          })
        ]);

        const detailBody = (await detailResponse.json().catch(() => null)) as
          | { retainer?: ClientRetainerDetail; error?: string }
          | null;
        const historyBody = (await historyResponse.json().catch(() => null)) as
          | ClientRetainerHistoryResponse
          | { error?: string }
          | null;

        if (!detailResponse.ok || !detailBody?.retainer) {
          throw new Error(detailBody?.error ?? "Failed to load retainer");
        }

        setRetainer(detailBody.retainer);
        setHistory(
          historyResponse.ok && historyBody && "periods" in historyBody
            ? historyBody
            : { periods: [] }
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load retainer");
      } finally {
        setLoading(false);
      }
    }

    void loadRetainer();
  }, [retainerId]);

  return (
    <ClientShell>
      <div className="space-y-6">
        <header>
          <Link
            href="/client/projects"
            className="text-sm font-medium text-[#51d0b0] hover:underline"
          >
            ← Back to projects
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-text-muted">
            Retainer
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {retainer?.name ?? "Loading retainer"}
          </h1>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Service line</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {retainer ? formatServiceLine(retainer.serviceLine) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Current balance</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {retainer?.currentPeriod ? `${retainer.currentPeriod.remainingHours}h` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Refresh</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {retainer?.currentPeriod ? `${retainer.currentPeriod.daysUntilRefresh} days` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Status</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {retainer?.status ?? "—"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-background-card p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Current period
          </p>
          {retainer?.currentPeriod ? (
            <>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#51d0b0]"
                  style={{
                    width: `${Math.min(
                      100,
                      (retainer.currentPeriod.consumedHours /
                        Math.max(retainer.currentPeriod.totalAvailable, 1)) *
                        100
                    )}%`
                  }}
                />
              </div>
              <p className="mt-4 text-base font-semibold text-white">
                {retainer.currentPeriod.consumedHours} hours used ·{" "}
                {retainer.currentPeriod.remainingHours} hours remaining ·{" "}
                {retainer.currentPeriod.daysUntilRefresh} days until refresh
              </p>
              {retainer.currentPeriod.rolledInHours > 0 &&
              retainer.rolloverBuckets.length > 0 ? (
                <p className="mt-2 text-sm text-text-secondary">
                  Includes {retainer.currentPeriod.rolledInHours}h rolled forward.
                  Next expiry {formatDate(retainer.rolloverBuckets[0].expiresAt)}.
                </p>
              ) : null}
              {retainer.currentPeriod.borrowedFromNext > 0 ? (
                <p className="mt-2 text-sm text-[#f0c060]">
                  {retainer.currentPeriod.borrowedFromNext}h borrowed from next month.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm text-text-secondary">
              No active period is available right now.
            </p>
          )}
        </section>

        {retainer?.currentPeriod?.topUps.some((topUp) => topUp.status === "QUOTED") ? (
          <section className="rounded-2xl border border-[#f0c060]/35 bg-[#f0c060]/10 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[#f0c060]">
              Top-up pending approval
            </p>
            <div className="mt-4 space-y-3">
              {retainer.currentPeriod.topUps
                .filter((topUp) => topUp.status === "QUOTED")
                .map((topUp) => (
                  <Link
                    key={topUp.id}
                    href={`/client/retainers/${retainer.id}/top-ups/${topUp.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <p className="font-semibold text-white">
                      {topUp.hours} additional hours · {formatMoney(topUp.total, retainer.currency)}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Review and approve the quoted top-up to keep work moving.
                    </p>
                  </Link>
                ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-background-card p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Usage history
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-text-secondary">
              <thead className="text-xs uppercase tracking-[0.16em] text-text-muted">
                <tr>
                  <th className="pb-3 pr-4">Month</th>
                  <th className="pb-3 pr-4">Block</th>
                  <th className="pb-3 pr-4">Rolled in</th>
                  <th className="pb-3 pr-4">Consumed</th>
                  <th className="pb-3 pr-4">Top-ups</th>
                  <th className="pb-3 pr-4">Borrow</th>
                  <th className="pb-3 pr-4">Rolled out</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {history?.periods.map((period) => (
                  <tr key={period.id} className="border-t border-white/8">
                    <td className="py-3 pr-4 text-white">{formatDate(period.periodMonth)}</td>
                    <td className="py-3 pr-4">{period.blockHours}h</td>
                    <td className="py-3 pr-4">{period.rolledInHours}h</td>
                    <td className="py-3 pr-4">{period.consumedHours}h</td>
                    <td className="py-3 pr-4">{period.approvedTopUpHours}h</td>
                    <td className="py-3 pr-4">{period.borrowedFromNext}h</td>
                    <td className="py-3 pr-4">{period.rolledOutHours}h</td>
                    <td className="py-3">{period.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {retainer && retainer.billToEntity.type === "CLIENT" ? (
          <section className="rounded-2xl border border-white/10 bg-background-card p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Invoices
            </p>
            <div className="mt-4 space-y-3">
              {retainer.visibleInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-white">{invoice.reference}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="text-sm text-text-secondary md:text-right">
                      <p className="text-white">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </p>
                      <p>{invoice.status}</p>
                      {invoice.xeroUrl ? (
                        <a
                          href={invoice.xeroUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex font-medium text-[#51d0b0] hover:underline"
                        >
                          View invoice
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && retainer.visibleInvoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm text-text-secondary">
                  No invoice records have been shared for this retainer yet.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </ClientShell>
  );
}
