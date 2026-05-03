"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";

type Owner = {
  owner: string;
  openTaskCount: number;
  openHours: number;
  hoursLast14d: number;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    plannedHours: number | null;
    projectId: string;
    projectName: string;
  }>;
};

export default function CapacityWorkspace() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizonStart, setHorizonStart] = useState<string | null>(null);
  const [horizonEnd, setHorizonEnd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/capacity", { credentials: "include" });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "Failed");
        if (!cancelled) {
          setOwners(body.owners ?? []);
          setHorizonStart(body.horizonStart ?? null);
          setHorizonEnd(body.horizonEnd ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-amber-300" />
          <div>
            <h1 className="text-3xl font-semibold text-white">Capacity</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Open tasks grouped by owner across all projects.
              {horizonStart && horizonEnd
                ? ` 14-day horizon: ${horizonStart.slice(0, 10)} → ${horizonEnd.slice(0, 10)}.`
                : ""}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : owners.length === 0 ? (
        <p className="text-sm text-text-secondary">No open tasks across the workspace.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {owners.map((o) => {
            const burn = o.hoursLast14d;
            const overload = o.openHours > 60;
            return (
              <section
                key={o.owner}
                className="brand-surface rounded-3xl border p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{o.owner}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      overload
                        ? "bg-rose-500/30 text-rose-100"
                        : "bg-emerald-500/20 text-emerald-100"
                    }`}
                  >
                    {o.openHours.toFixed(0)}h open · {o.openTaskCount} tasks
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Logged last 14d: {burn.toFixed(1)}h
                </p>
                <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10">
                  {o.tasks.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center justify-between p-3 text-sm">
                      <div className="min-w-0 flex-1 pr-3">
                        <Link
                          href={`/projects/${t.projectId}`}
                          className="font-medium text-white hover:underline"
                        >
                          {t.title}
                        </Link>
                        <p className="text-xs text-text-secondary">{t.projectName}</p>
                      </div>
                      <span className="text-xs text-text-secondary">
                        {t.plannedHours ? `${t.plannedHours.toFixed(1)}h` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
