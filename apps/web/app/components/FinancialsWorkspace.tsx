"use client";

import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface FinancialsSummary {
  headline: {
    pipelineValue: number;
    pipelineCount: number;
    approvedValue: number;
    approvedCount: number;
    wonThisMonthValue: number;
    wonThisMonthCount: number;
    mrrZar: number;
    activeRetainers: number;
    annualisedRecurringZar: number;
  };
  quoteFunnel: {
    draft: number;
    sent: number;
    approved: number;
    won: number;
    lost: number;
    archived: number;
    superseded: number;
    wonValue: number;
    wonCount: number;
    lostValue: number;
    lostCount: number;
    winRate: number | null;
  };
  monthly: Array<{ month: string; wonValue: number; wonCount: number }>;
  recurring: {
    mrrZar: number;
    activeRetainers: number;
    retainersByClient: Array<{
      clientId: string;
      clientName: string;
      monthlyZar: number;
      retainers: number;
    }>;
  };
  topClients: Array<{
    clientId: string;
    clientName: string;
    wonZar: number;
    recurringZar: number;
    totalZar: number;
  }>;
}

function formatMoney(amount: number) {
  if (!Number.isFinite(amount) || amount === 0) {
    return "ZAR 0";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCount(value: number, singular: string, plural?: string) {
  if (value === 1) return `1 ${singular}`;
  return `${value} ${plural ?? `${singular}s`}`;
}

export default function FinancialsWorkspace() {
  const [summary, setSummary] = useState<FinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/financials/summary", {
          credentials: "include"
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load financials");
        }
        const body = (await response.json()) as FinancialsSummary;
        setSummary(body);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load financials"
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const maxMonthlyValue = summary
    ? Math.max(1, ...summary.monthly.map((m) => m.wonValue))
    : 1;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[#49cde1]">
            Sales
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Financials
          </h1>
          <p className="text-sm text-text-secondary">
            Pipeline, recurring revenue, win rate, and top clients. Numbers come
            from your live quote and retainer data.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading || !summary ? (
          <div className="rounded-2xl border border-white/10 bg-background-card px-5 py-8 text-sm text-text-secondary">
            Loading financials...
          </div>
        ) : (
          <>
            {/* Headline metrics */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-background-card p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-text-muted">
                  Pipeline (sent)
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatMoney(summary.headline.pipelineValue)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {formatCount(summary.headline.pipelineCount, "open quote")}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-200/80">
                  Approved (awaiting close)
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatMoney(summary.headline.approvedValue)}
                </p>
                <p className="mt-1 text-xs text-amber-200/70">
                  {formatCount(summary.headline.approvedCount, "quote")}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/80">
                  Won this month
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatMoney(summary.headline.wonThisMonthValue)}
                </p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  {formatCount(summary.headline.wonThisMonthCount, "deal")}
                </p>
              </div>

              <div className="rounded-2xl border border-[#49cde1]/30 bg-[#49cde1]/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#9be4f0]/80">
                  Monthly recurring
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatMoney(summary.headline.mrrZar)}
                </p>
                <p className="mt-1 text-xs text-[#9be4f0]/70">
                  {formatCount(
                    summary.headline.activeRetainers,
                    "active retainer"
                  )}{" "}
                  · {formatMoney(summary.headline.annualisedRecurringZar)}/yr
                </p>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              {/* Won by month chart */}
              <section className="rounded-2xl border border-white/10 bg-background-card p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
                      Won deals by month
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Last 6 months
                    </h2>
                  </div>
                  <p className="text-sm text-text-muted">
                    Total{" "}
                    {formatMoney(
                      summary.monthly.reduce((sum, m) => sum + m.wonValue, 0)
                    )}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-6 items-end gap-3 px-1">
                  {summary.monthly.map((bucket) => {
                    const height =
                      bucket.wonValue > 0
                        ? Math.max(
                            6,
                            Math.round((bucket.wonValue / maxMonthlyValue) * 160)
                          )
                        : 4;
                    return (
                      <div
                        key={bucket.month}
                        className="flex flex-col items-center gap-2"
                      >
                        <span className="text-xs text-white">
                          {bucket.wonValue > 0
                            ? formatMoney(bucket.wonValue)
                            : "—"}
                        </span>
                        <div
                          className={`w-full rounded-md ${bucket.wonValue > 0 ? "bg-[linear-gradient(180deg,#51d0b0_0%,#49cde1_100%)]" : "bg-white/5"}`}
                          style={{ height: `${height}px` }}
                          title={`${bucket.wonCount} deal(s) · ${formatMoney(bucket.wonValue)}`}
                        />
                        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                          {bucket.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Quote funnel */}
              <section className="rounded-2xl border border-white/10 bg-background-card p-6">
                <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
                  Quote funnel
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Status breakdown
                </h2>

                <div className="mt-5 space-y-3">
                  {[
                    { label: "Draft", value: summary.quoteFunnel.draft },
                    { label: "Sent", value: summary.quoteFunnel.sent },
                    { label: "Approved", value: summary.quoteFunnel.approved },
                    { label: "Won", value: summary.quoteFunnel.won },
                    { label: "Lost", value: summary.quoteFunnel.lost },
                    {
                      label: "Archived",
                      value: summary.quoteFunnel.archived
                    },
                    {
                      label: "Superseded",
                      value: summary.quoteFunnel.superseded
                    }
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="text-sm text-text-secondary">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {summary.quoteFunnel.winRate !== null ? (
                  <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/80">
                      Win rate
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-100">
                      {summary.quoteFunnel.winRate}%
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/70">
                      {summary.quoteFunnel.wonCount} won ·{" "}
                      {summary.quoteFunnel.lostCount} lost
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recurring revenue by client */}
              <section className="rounded-2xl border border-white/10 bg-background-card p-6">
                <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
                  Recurring revenue
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  By client
                </h2>

                {summary.recurring.retainersByClient.length === 0 ? (
                  <p className="mt-5 text-sm text-text-secondary">
                    No active retainers yet.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {summary.recurring.retainersByClient.map((row) => (
                      <li
                        key={row.clientId}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {row.clientName}
                          </p>
                          <p className="text-xs text-text-muted">
                            {formatCount(row.retainers, "retainer")}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {formatMoney(row.monthlyZar)}/mo
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Top clients by total revenue */}
              <section className="rounded-2xl border border-white/10 bg-background-card p-6">
                <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
                  Top clients
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Won + 12-month recurring
                </h2>

                {summary.topClients.length === 0 ? (
                  <p className="mt-5 text-sm text-text-secondary">
                    No revenue captured yet.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {summary.topClients.map((row) => (
                      <li
                        key={row.clientId}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">
                            {row.clientName}
                          </p>
                          <p className="text-sm font-semibold text-white tabular-nums">
                            {formatMoney(row.totalZar)}
                          </p>
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-text-muted">
                          <span>Won {formatMoney(row.wonZar)}</span>
                          <span>·</span>
                          <span>Recurring {formatMoney(row.recurringZar)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
