"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Pill } from "./ui/Pill";
import { SectionCard } from "./ui/SectionCard";

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

  const horizonText =
    horizonStart && horizonEnd
      ? `14-day horizon: ${horizonStart.slice(0, 10)} → ${horizonEnd.slice(0, 10)}`
      : "Open tasks grouped by owner across all projects.";

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead eyebrow="Delivery" title="Capacity" lede={horizonText} />

        {error ? (
          <Empty title="Capacity feed error" sub={error} />
        ) : loading ? (
          <Empty title="Loading capacity…" sub="One moment." />
        ) : owners.length === 0 ? (
          <Empty
            title="No open tasks"
            sub="Nothing assigned across the workspace right now."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {owners.map((o) => {
              const overload = o.openHours > 60;
              return (
                <SectionCard
                  key={o.owner}
                  title={o.owner}
                  subtitle={`Logged last 14d: ${o.hoursLast14d.toFixed(1)}h`}
                  right={
                    <Pill tone={overload ? "danger" : "ok"} dot>
                      <span className="font-mono">
                        {o.openHours.toFixed(0)}h
                      </span>
                      <span>· {o.openTaskCount}</span>
                    </Pill>
                  }
                  flush
                >
                  <ul className="divide-y divide-ink-4">
                    {o.tasks.slice(0, 8).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 px-[18px] py-3 text-[13px]"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${t.projectId}`}
                            className="font-medium text-text-1 hover:text-status-ok transition-colors truncate block"
                          >
                            {t.title}
                          </Link>
                          <p className="text-[11.5px] text-text-3 truncate">
                            {t.projectName}
                          </p>
                        </div>
                        <span className="font-mono text-[12px] text-text-3 whitespace-nowrap">
                          {t.plannedHours
                            ? `${t.plannedHours.toFixed(1)}h`
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
