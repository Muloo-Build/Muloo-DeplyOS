"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";

interface TopUpDetail {
  retainer: {
    id: string;
    name: string;
    currency: string;
  };
  topUp: {
    id: string;
    hours: number;
    rate: number;
    status: string;
    quotedAt: string;
    approvedAt: string | null;
    total: number;
  };
  summary: {
    consumedHours: number;
    includedHours: number;
  };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ClientTopUpApprovalWorkspace({
  retainerId,
  topUpId
}: {
  retainerId: string;
  topUpId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TopUpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadTopUp() {
    try {
      const response = await fetch(
        `/api/client/retainers/${encodeURIComponent(retainerId)}/top-ups/${encodeURIComponent(topUpId)}`,
        { credentials: "include" }
      );
      const body = (await response.json().catch(() => null)) as
        | TopUpDetail
        | { error?: string }
        | null;

      if (!response.ok || !body || !("topUp" in body)) {
        throw new Error(
          body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Failed to load top-up"
        );
      }

      setDetail(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load top-up");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTopUp();
  }, [retainerId, topUpId]);

  async function approveTopUp() {
    setSubmitting(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/client/retainers/${encodeURIComponent(retainerId)}/top-ups/${encodeURIComponent(topUpId)}/approve`,
        {
          method: "POST",
          credentials: "include"
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { topUp?: { hours: number }; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to approve top-up");
      }

      setFeedback(
        `Top-up approved. ${body?.topUp?.hours ?? detail?.topUp.hours ?? 0} hours added to this month's balance.`
      );
      await loadTopUp();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to approve top-up"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClientShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header>
          <Link
            href={`/client/retainers/${retainerId}`}
            className="text-sm font-medium text-[#51d0b0] hover:underline"
          >
            ← Back to retainer
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-text-3">
            Top-up approval
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {detail?.retainer.name ?? "Loading top-up"}
          </h1>
        </header>

        {error ? (
          <div className="rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="rounded-[14px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback}
          </div>
        ) : null}

        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
          <p className="text-sm leading-7 text-text-2">
            You've used {detail?.summary.consumedHours ?? 0} of{" "}
            {detail?.summary.includedHours ?? 0} hours this month. Continuing work
            requires additional hours to be approved.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Additional hours
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {detail?.topUp.hours ?? 0}h
              </p>
            </div>
            <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Rate
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {detail ? formatMoney(detail.topUp.rate, detail.retainer.currency) : "—"}
              </p>
            </div>
            <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Total
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {detail ? formatMoney(detail.topUp.total, detail.retainer.currency) : "—"}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-text-2">
            Quoted {detail?.topUp.quotedAt ? formatDate(detail.topUp.quotedAt) : "—"}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void approveTopUp()}
              disabled={submitting || loading || detail?.topUp.status !== "QUOTED"}
              className="rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/client/projects")}
              className="rounded-xl border border-ink-4 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
            >
              Request to discuss
            </button>
          </div>
        </section>
      </div>
    </ClientShell>
  );
}
