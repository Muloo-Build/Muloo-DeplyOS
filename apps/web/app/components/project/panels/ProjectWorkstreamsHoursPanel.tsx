"use client";

import { useEffect, useState } from "react";

interface WorkstreamHourRow {
  workstreamId: string;
  name: string;
  category: string;
  status: string;
  owner: string;
  billingOwner: string | null;
  deliveryOwner: string | null;
  estimatedHours: number | null;
  hourCap: number | null;
  plannedHours: number;
  actualHours: number;
  billableHours: number;
  remainingHours: number | null;
  percentOfCap: number | null;
  taskCount: number;
  scopeRisk: "low" | "medium" | "high" | null;
}

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-rose-400"
};

function formatHours(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}h`;
}

function formatPct(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(0)}%`;
}

export default function ProjectWorkstreamsHoursPanel(props: {
  projectId: string;
}) {
  const [rows, setRows] = useState<WorkstreamHourRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${props.projectId}/workstream-hours`, {
      credentials: "include"
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setRows(data.workstreamHours ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  if (error) {
    return <p className="text-sm text-rose-400">{error}</p>;
  }

  if (!rows) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No workstreams defined yet. Add them in project edit.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const overCap =
          row.hourCap !== null && row.actualHours > row.hourCap;
        return (
          <div
            key={row.workstreamId}
            className="brand-surface-soft rounded-2xl border p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-white">{row.name}</h4>
                <p className="text-xs text-text-secondary">
                  {row.category} · {row.status} · owner {row.owner}
                  {row.billingOwner ? ` · billing ${row.billingOwner}` : ""}
                  {row.deliveryOwner ? ` · delivery ${row.deliveryOwner}` : ""}
                </p>
              </div>
              {row.scopeRisk ? (
                <span
                  className={`text-xs uppercase tracking-wide ${
                    RISK_COLORS[row.scopeRisk] ?? ""
                  }`}
                >
                  {row.scopeRisk} risk
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <div className="text-text-secondary">Estimated</div>
                <div className="text-white">
                  {formatHours(row.estimatedHours)}
                </div>
              </div>
              <div>
                <div className="text-text-secondary">Cap</div>
                <div className="text-white">{formatHours(row.hourCap)}</div>
              </div>
              <div>
                <div className="text-text-secondary">Used</div>
                <div className={overCap ? "text-rose-400" : "text-white"}>
                  {formatHours(row.actualHours)}
                </div>
              </div>
              <div>
                <div className="text-text-secondary">Remaining</div>
                <div className={overCap ? "text-rose-400" : "text-white"}>
                  {formatHours(row.remainingHours)}
                </div>
              </div>
            </div>

            {row.hourCap !== null && row.hourCap > 0 ? (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full ${overCap ? "bg-rose-500" : "bg-brand-teal"}`}
                  style={{
                    width: `${Math.min(100, row.percentOfCap ?? 0)}%`
                  }}
                />
              </div>
            ) : null}

            <p className="mt-2 text-xs text-text-secondary">
              {row.taskCount} task{row.taskCount === 1 ? "" : "s"} linked ·{" "}
              {formatPct(row.percentOfCap)} of cap
            </p>
          </div>
        );
      })}
    </div>
  );
}
