"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import { PageHead } from "./ui/PageHead";

// T6.2 / T6.3 — Financials snapshot now scoped to a date range with a
// prior-period comparison and a forward-looking 90-day forecast block.
interface FinancialsRange {
  key: "this_quarter" | "this_year" | "custom";
  label: string;
  from: string;
  to: string;
}

interface FinancialsSummary {
  range: FinancialsRange;
  priorRange: { label: string; from: string; to: string };
  headline: {
    pipelineValue: number;
    pipelineCount: number;
    approvedValue: number;
    approvedCount: number;
    wonInRangeValue: number;
    wonInRangeCount: number;
    mrrZar: number;
    activeRetainers: number;
    annualisedRecurringZar: number;
    externalApprovedTotalZar: number;
    externalApprovedCount: number;
    externalApprovedInRangeValue: number;
    externalApprovedInRangeCount: number;
  };
  prior: {
    wonValue: number;
    wonCount: number;
    lostValue: number;
    lostCount: number;
    winRate: number | null;
    deltas: {
      wonValue: number | null;
      wonCount: number | null;
      winRate: number | null;
    };
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
    wonInRangeValue: number;
    wonInRangeCount: number;
    lostInRangeValue: number;
    lostInRangeCount: number;
    winRate: number | null;
    winRateInRange: number | null;
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
  forecast90: {
    horizonDays: number;
    horizonEndsAt: string;
    recurringZar: number;
    pipelineWeightedZar: number;
    combinedZar: number;
    confidenceLowerZar: number;
    confidenceUpperZar: number;
    bandPct: number;
    breakdown: {
      sentValue: number;
      sentCount: number;
      sentWeight: number;
      sentWeightedZar: number;
      approvedValue: number;
      approvedCount: number;
      approvedWeight: number;
      approvedWeightedZar: number;
      wonOpenValue: number;
      wonOpenCount: number;
      wonWeight: number;
      wonWeightedZar: number;
      wonWindowDays?: number;
      mrrZar: number;
    };
  };
  // T22 — Multi-currency disclosure. `baseCurrency` is the currency every
  // *Zar suffixed figure has been converted into; `byCurrency` shows the
  // raw native amounts so operators can sanity-check the conversion.
  fx: {
    baseCurrency: string;
    asOf: string;
    rates: Record<string, number>;
    byCurrency: {
      pipeline: CurrencyBucket[];
      approved: CurrencyBucket[];
      wonInRange: CurrencyBucket[];
      externalApproved: CurrencyBucket[];
    };
  };
  externalApproved: Array<{
    projectId: string;
    projectName: string;
    clientId: string | null;
    clientName: string;
    clientSlug: string | null;
    nativeValue: number;
    currency: string;
    zarValue: number;
    approvedAt: string | null;
    source: string | null;
  }>;
}

interface CurrencyBucket {
  currency: string;
  nativeValue: number;
  baseZar: number;
  count: number;
}

function formatMoney(amount: number, currency: string = "ZAR") {
  if (!Number.isFinite(amount) || amount === 0) {
    return `${currency} 0`;
  }
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    // Fallback for currency codes Intl doesn't recognise.
    return `${currency} ${Math.round(amount).toLocaleString("en-GB")}`;
  }
}

// T22 — Compact pill that shows native-currency totals beneath a converted
// headline figure. Renders nothing for single-currency mixes (since the
// headline already says it all).
function CurrencyMix({ buckets }: { buckets: CurrencyBucket[] }) {
  if (!buckets || buckets.length <= 1) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {buckets.map((bucket) => (
        <span
          key={bucket.currency}
          className="inline-flex items-center gap-1 rounded-full border border-ink-4 bg-white/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-text-2"
          title={`${bucket.count} quote${bucket.count === 1 ? "" : "s"} in ${bucket.currency}`}
        >
          {formatMoney(bucket.nativeValue, bucket.currency)}
        </span>
      ))}
    </div>
  );
}

function formatCount(value: number, singular: string, plural?: string) {
  if (value === 1) return `1 ${singular}`;
  return `${value} ${plural ?? `${singular}s`}`;
}

// Delta arrow + colour. Higher-is-better metrics use the default polarity;
// pass invert=true for metrics where lower is better.
function DeltaBadge({
  delta,
  suffix = "%",
  invert = false
}: {
  delta: number | null;
  suffix?: string;
  invert?: boolean;
}) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ink-4 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-text-3">
        — no prior
      </span>
    );
  }
  const positive = invert ? delta < 0 : delta > 0;
  const negative = invert ? delta > 0 : delta < 0;
  const tone = positive
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
    : negative
      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
      : "border-ink-4 bg-white/5 text-text-2";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "■";
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
    >
      <span>{arrow}</span>
      <span>
        {sign}
        {delta.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function quarterStartIso() {
  const now = new Date();
  const qMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), qMonth, 1).toISOString().slice(0, 10);
}

export default function FinancialsWorkspace() {
  const [summary, setSummary] = useState<FinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // T6.2 — range picker state. Custom dates only submit when both are set.
  const [rangeKey, setRangeKey] = useState<
    "this_quarter" | "this_year" | "custom"
  >("this_quarter");
  const [customFrom, setCustomFrom] = useState<string>(quarterStartIso());
  const [customTo, setCustomTo] = useState<string>(todayIso());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range: rangeKey });
        if (rangeKey === "custom") {
          if (!customFrom || !customTo) {
            setLoading(false);
            return;
          }
          params.set("from", customFrom);
          params.set("to", customTo);
        }
        const response = await fetch(
          `/api/financials/summary?${params.toString()}`,
          { credentials: "include" }
        );
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
  }, [rangeKey, customFrom, customTo]);

  const maxMonthlyValue = useMemo(
    () =>
      summary ? Math.max(1, ...summary.monthly.map((m) => m.wonValue)) : 1,
    [summary]
  );

  const forecastPipelineRatio = useMemo(() => {
    if (!summary) return 0;
    const combined = summary.forecast90.combinedZar;
    if (combined <= 0) return 0;
    return (summary.forecast90.pipelineWeightedZar / combined) * 100;
  }, [summary]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full flex flex-col gap-6">
        <PageHead
          eyebrow="Sales"
          title="Financials"
          lede="Pipeline, recurring revenue, win rate, top clients, and a 90-day forecast. Numbers come from your live quote and retainer data."
        />

        {/* T6.2 — Range picker */}
        <section className="flex flex-col gap-3 rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { value: "this_quarter", label: "This quarter" },
                { value: "this_year", label: "This year" },
                { value: "custom", label: "Custom" }
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeKey(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  rangeKey === opt.value
                    ? "border-[#51d0b0]/50 bg-[#51d0b0]/10 text-[#9be4d2]"
                    : "border-ink-4 bg-ink-0 text-text-2 hover:border-ink-5 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {rangeKey === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-ink-4 bg-ink-0 px-3 py-1.5 text-xs text-white"
                />
                <span className="text-xs text-text-3">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayIso()}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-ink-4 bg-ink-0 px-3 py-1.5 text-xs text-white"
                />
              </div>
            ) : null}
          </div>
          {summary ? (
            <div className="flex flex-col gap-1 lg:items-end">
              <p className="text-xs text-text-3">
                <span className="text-text-2">
                  {summary.range.label}
                </span>{" "}
                · vs prior{" "}
                <span className="text-text-2">
                  {summary.priorRange.label}
                </span>
              </p>
              {/* T22 — FX disclosure so operators know amounts are converted. */}
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                Converted to {summary.fx.baseCurrency} · FX as of{" "}
                {summary.fx.asOf}
              </p>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading || !summary ? (
          <div className="rounded-[14px] border border-ink-4 bg-ink-1 px-5 py-8 text-sm text-text-2">
            Loading financials...
          </div>
        ) : (
          (() => {
            // T22 — Use the API-supplied base currency for every converted
            // figure so the UI tracks whatever ZAR/other base the backend
            // declares. Bound once here to keep the JSX below readable.
            const base = summary.fx.baseCurrency;
            const fmt = (amount: number) => formatMoney(amount, base);
            return (
          <>
            {/* Headline metrics */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                  Pipeline (sent)
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {fmt(summary.headline.pipelineValue)}
                </p>
                <p className="mt-1 text-xs text-text-3">
                  {formatCount(summary.headline.pipelineCount, "open quote")}
                </p>
                <CurrencyMix buckets={summary.fx.byCurrency.pipeline} />
              </div>

              <div className="rounded-[14px] border border-amber-400/30 bg-amber-500/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">
                  Approved (awaiting close)
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {fmt(summary.headline.approvedValue)}
                </p>
                <p className="mt-1 text-xs text-amber-200/70">
                  {formatCount(summary.headline.approvedCount, "quote")}
                </p>
                <CurrencyMix buckets={summary.fx.byCurrency.approved} />
              </div>

              <div className="rounded-[14px] border border-emerald-400/30 bg-emerald-500/5 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">
                    Won · {summary.range.label}
                  </p>
                  <DeltaBadge delta={summary.prior.deltas.wonValue} />
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {fmt(summary.headline.wonInRangeValue)}
                </p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  {formatCount(summary.headline.wonInRangeCount, "deal")} · prior{" "}
                  {fmt(summary.prior.wonValue)}
                </p>
                {summary.headline.externalApprovedInRangeCount > 0 ? (
                  <p className="mt-1 text-[11px] text-emerald-200/60">
                    Incl.{" "}
                    {formatCount(
                      summary.headline.externalApprovedInRangeCount,
                      "external"
                    )}{" "}
                    · {fmt(summary.headline.externalApprovedInRangeValue)}
                  </p>
                ) : null}
                <CurrencyMix buckets={summary.fx.byCurrency.wonInRange} />
              </div>

              <div className="rounded-[14px] border border-[#49cde1]/30 bg-[#49cde1]/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#9be4f0]/80">
                  Monthly recurring
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {fmt(summary.headline.mrrZar)}
                </p>
                <p className="mt-1 text-xs text-[#9be4f0]/70">
                  {formatCount(
                    summary.headline.activeRetainers,
                    "active retainer"
                  )}{" "}
                  · {fmt(summary.headline.annualisedRecurringZar)}/yr
                </p>
              </div>
            </section>

            {/* T6.3 — 90-day forecast block */}
            <section className="rounded-[14px] border border-[#51d0b0]/30 bg-[linear-gradient(135deg,rgba(81,208,176,0.08)_0%,rgba(73,205,225,0.08)_100%)] p-6">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#9be4d2]">
                    90-day forecast
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Recurring + weighted pipeline
                  </h2>
                  <p className="mt-1 text-xs text-text-3">
                    Sent {Math.round(summary.forecast90.breakdown.sentWeight * 100)}% ·
                    Approved {Math.round(summary.forecast90.breakdown.approvedWeight * 100)}% ·
                    Won {Math.round(summary.forecast90.breakdown.wonWeight * 100)}% · ±
                    {Math.round(summary.forecast90.bandPct * 100)}% confidence band
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold text-white tabular-nums">
                    {fmt(summary.forecast90.combinedZar)}
                  </p>
                  <p className="mt-1 text-xs text-text-3">
                    {fmt(summary.forecast90.confidenceLowerZar)} –{" "}
                    {fmt(summary.forecast90.confidenceUpperZar)}
                  </p>
                </div>
              </div>

              {/* Stacked composition bar (recurring vs pipeline). */}
              <div className="mt-5 h-3 w-full overflow-hidden rounded-full border border-ink-4 bg-white/5">
                <div className="flex h-full">
                  <div
                    className="h-full bg-[#49cde1]"
                    style={{ width: `${100 - forecastPipelineRatio}%` }}
                    title={`Recurring ${fmt(summary.forecast90.recurringZar)}`}
                  />
                  <div
                    className="h-full bg-[#51d0b0]"
                    style={{ width: `${forecastPipelineRatio}%` }}
                    title={`Pipeline (weighted) ${fmt(summary.forecast90.pipelineWeightedZar)}`}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-ink-4 bg-ink-0/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#9be4f0]/80">
                    Recurring (committed)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                    {fmt(summary.forecast90.recurringZar)}
                  </p>
                  <p className="text-xs text-text-3">
                    MRR {fmt(summary.forecast90.breakdown.mrrZar)} × 3 mo
                  </p>
                </div>
                <div className="rounded-xl border border-ink-4 bg-ink-0/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                    Sent · 30%
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                    {fmt(summary.forecast90.breakdown.sentWeightedZar)}
                  </p>
                  <p className="text-xs text-text-3">
                    {fmt(summary.forecast90.breakdown.sentValue)} ·{" "}
                    {formatCount(
                      summary.forecast90.breakdown.sentCount,
                      "quote"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">
                    Approved · 70%
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                    {fmt(
                      summary.forecast90.breakdown.approvedWeightedZar
                    )}
                  </p>
                  <p className="text-xs text-amber-200/70">
                    {fmt(
                      summary.forecast90.breakdown.approvedValue
                    )}{" "}
                    ·{" "}
                    {formatCount(
                      summary.forecast90.breakdown.approvedCount,
                      "quote"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">
                    Won · 100%
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                    {fmt(summary.forecast90.breakdown.wonWeightedZar)}
                  </p>
                  <p className="text-xs text-emerald-200/70">
                    {formatCount(
                      summary.forecast90.breakdown.wonOpenCount,
                      "deal"
                    )}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              {/* Won by month chart */}
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                      Won deals by month
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {summary.range.label}
                    </h2>
                  </div>
                  <p className="text-sm text-text-3">
                    Total{" "}
                    {fmt(
                      summary.monthly.reduce((sum, m) => sum + m.wonValue, 0)
                    )}
                  </p>
                </div>

                <div
                  className="mt-6 grid items-end gap-3 px-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, summary.monthly.length)}, minmax(0, 1fr))`
                  }}
                >
                  {summary.monthly.map((bucket) => {
                    const height =
                      bucket.wonValue > 0
                        ? Math.max(
                            6,
                            Math.round(
                              (bucket.wonValue / maxMonthlyValue) * 160
                            )
                          )
                        : 4;
                    return (
                      <div
                        key={bucket.month}
                        className="flex flex-col items-center gap-2"
                      >
                        <span className="text-xs text-white">
                          {bucket.wonValue > 0
                            ? fmt(bucket.wonValue)
                            : "—"}
                        </span>
                        <div
                          className={`w-full rounded-md ${bucket.wonValue > 0 ? "bg-[linear-gradient(180deg,#51d0b0_0%,#49cde1_100%)]" : "bg-white/5"}`}
                          style={{ height: `${height}px` }}
                          title={`${bucket.wonCount} deal(s) · ${fmt(bucket.wonValue)}`}
                        />
                        <span className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                          {bucket.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Quote funnel */}
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
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
                      <span className="text-sm text-text-2">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {summary.quoteFunnel.winRateInRange !== null ? (
                  <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">
                        Win rate · {summary.range.label}
                      </p>
                      <DeltaBadge
                        delta={summary.prior.deltas.winRate}
                        suffix="pp"
                      />
                    </div>
                    <p className="mt-1 text-lg font-semibold text-emerald-100">
                      {summary.quoteFunnel.winRateInRange}%
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/70">
                      {summary.quoteFunnel.wonInRangeCount} won ·{" "}
                      {summary.quoteFunnel.lostInRangeCount} lost · prior{" "}
                      {summary.prior.winRate ?? "—"}%
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {/* Recurring revenue by client */}
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                  Recurring revenue
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  By client
                </h2>

                {summary.recurring.retainersByClient.length === 0 ? (
                  <p className="mt-5 text-sm text-text-2">
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
                          <p className="text-xs text-text-3">
                            {formatCount(row.retainers, "retainer")}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {fmt(row.monthlyZar)}/mo
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* External-approved deals — revenue committed outside the
                  platform (signed PDF, email, etc.) feeds Won totals but is
                  surfaced here so operators can trace the source. */}
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                      Externally approved
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Deals approved off-platform
                    </h2>
                  </div>
                  {summary.headline.externalApprovedCount > 0 ? (
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white tabular-nums">
                        {fmt(summary.headline.externalApprovedTotalZar)}
                      </p>
                      <p className="text-xs text-text-3">
                        {formatCount(
                          summary.headline.externalApprovedCount,
                          "deal"
                        )}{" "}
                        · {fmt(summary.headline.externalApprovedInRangeValue)}{" "}
                        in range
                      </p>
                    </div>
                  ) : null}
                </div>

                {summary.externalApproved.length === 0 ? (
                  <p className="mt-5 text-sm text-text-2">
                    Nothing marked externally approved yet. Use the project edit
                    page to log a signed PDF or off-platform agreement.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {summary.externalApproved.map((row) => (
                      <li
                        key={row.projectId}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {row.projectName}
                            </p>
                            <p className="text-xs text-text-3">
                              {row.clientName}
                              {row.approvedAt
                                ? ` · ${new Date(row.approvedAt).toLocaleDateString("en-GB")}`
                                : ""}
                              {row.source ? ` · ${row.source}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white tabular-nums">
                              {formatMoney(row.nativeValue, row.currency)}
                            </p>
                            {row.currency !== summary.fx.baseCurrency ? (
                              <p className="text-[10px] text-text-3">
                                ≈ {fmt(row.zarValue)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <CurrencyMix
                  buckets={summary.fx.byCurrency.externalApproved}
                />
              </section>

              {/* Top clients by total revenue */}
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                  Top clients
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Won + 12-month recurring
                </h2>

                {summary.topClients.length === 0 ? (
                  <p className="mt-5 text-sm text-text-2">
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
                            {fmt(row.totalZar)}
                          </p>
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-text-3">
                          <span>Won {fmt(row.wonZar)}</span>
                          <span>·</span>
                          <span>Recurring {fmt(row.recurringZar)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
            );
          })()
        )}
      </div>
    </AppShell>
  );
}
