"use client";

import { useEffect, useMemo, useState } from "react";

interface SpendBucket {
  key: string;
  label: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  erroredCount: number;
}

interface SpendSummary {
  fromDate: string;
  toDate: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  erroredCount: number;
  byProvider: SpendBucket[];
  byModel: SpendBucket[];
  byAgent: SpendBucket[];
  byProject: SpendBucket[];
  daily: { date: string; totalCostUsd: number; totalTokens: number; callCount: number }[];
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" }
];

function fmtUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

function fmtTokens(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export default function AISpendDashboard() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<SpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/ai-integrations/spend?days=${days}`
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed");
        if (!cancelled) setSummary(body.summary);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const dailyMax = useMemo(() => {
    if (!summary?.daily?.length) return 0;
    return summary.daily.reduce(
      (max, d) => Math.max(max, d.totalCostUsd),
      0
    );
  }, [summary]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                days === range.days
                  ? "bg-[#141d3d] text-white"
                  : "bg-background-card text-text-secondary"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        {summary ? (
          <div className="text-xs text-text-muted">
            {new Date(summary.fromDate).toLocaleDateString()} –{" "}
            {new Date(summary.toDate).toLocaleDateString()}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading spend...
        </div>
      ) : !summary ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Total spend
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {fmtUsd(summary.totalCostUsd)}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Tokens
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {fmtTokens(summary.totalTokens)}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Calls
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {summary.callCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Errors
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {summary.erroredCount.toLocaleString()}
              </p>
            </div>
          </div>

          {summary.daily.length > 0 ? (
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
                Daily burn
              </h3>
              <div className="mt-4 flex items-end gap-1 h-32">
                {summary.daily.map((d) => {
                  const heightPct =
                    dailyMax > 0 ? (d.totalCostUsd / dailyMax) * 100 : 0;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${fmtUsd(d.totalCostUsd)} · ${d.callCount} calls`}
                      className="flex-1 rounded-t bg-[linear-gradient(180deg,#e0529c,#7c5cbf)]"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-text-muted">
                <span>{summary.daily[0]?.date}</span>
                <span>{summary.daily[summary.daily.length - 1]?.date}</span>
              </div>
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <BucketTable title="By provider" buckets={summary.byProvider} />
            <BucketTable title="By model" buckets={summary.byModel} />
            <BucketTable title="By agent" buckets={summary.byAgent} />
            <BucketTable title="By project" buckets={summary.byProject} />
          </div>
        </>
      )}
    </div>
  );
}

function BucketTable({
  title,
  buckets
}: {
  title: string;
  buckets: SpendBucket[];
}) {
  return (
    <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
        {title}
      </h3>
      <div className="mt-4 space-y-2">
        {buckets.length === 0 ? (
          <p className="text-sm text-text-muted">No data in this range.</p>
        ) : (
          buckets.map((bucket) => (
            <div
              key={bucket.key}
              className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.04)] bg-[#0b1126] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {bucket.label}
                </p>
                <p className="text-xs text-text-muted">
                  {bucket.callCount} call(s) · {fmtTokens(bucket.totalTokens)} tokens
                  {bucket.erroredCount > 0 ? ` · ${bucket.erroredCount} errored` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold text-white">
                {fmtUsd(bucket.totalCostUsd)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
