"use client";

import { useCallback, useEffect, useState } from "react";

interface SummaryWorkbook {
  id: string;
  sourceLabel: string;
  resourceType: string | null;
  visibility: string | null;
  status: string | null;
  assignedContributorIds: string[];
}

const VISIBILITY_BADGE: Record<string, { label: string; className: string }> = {
  internal: {
    label: "Internal only",
    className: "border-white/10 bg-white/5 text-text-secondary"
  },
  contributor_link: {
    label: "Contributor access",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300"
  },
  client_champion: {
    label: "Champion review",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300"
  },
  client_portal: {
    label: "Client portal",
    className: "border-brand-teal/40 bg-brand-teal/10 text-brand-teal"
  }
};

export default function ProjectWorkbookSharingSummary({
  projectId,
  onOpenDiscovery
}: {
  projectId: string;
  onOpenDiscovery: () => void;
}) {
  const [workbooks, setWorkbooks] = useState<SummaryWorkbook[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workbooks`, {
        credentials: "include"
      });
      const data = await res.json();
      const all = (data.workbooks ?? []) as SummaryWorkbook[];
      setWorkbooks(
        all.filter((wb) => wb.resourceType === "internal_workbook")
      );
    } catch {
      setWorkbooks([]);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!workbooks) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  const counts = workbooks.reduce(
    (acc, wb) => {
      const k = (wb.visibility ?? "internal") as keyof typeof acc.byVisibility;
      acc.byVisibility[k] = (acc.byVisibility[k] ?? 0) + 1;
      return acc;
    },
    {
      byVisibility: {
        internal: 0,
        contributor_link: 0,
        client_champion: 0,
        client_portal: 0
      } as Record<string, number>
    }
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(VISIBILITY_BADGE).map(([key, badge]) => (
          <div
            key={key}
            className="brand-surface-soft rounded-xl border p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">
              {badge.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {counts.byVisibility[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {workbooks.length === 0 ? (
        <p className="text-xs text-text-secondary">
          No workbooks yet. Create one on the Discovery tab.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {workbooks.map((wb) => {
            const badge =
              VISIBILITY_BADGE[wb.visibility ?? "internal"] ??
              VISIBILITY_BADGE.internal;
            return (
              <li
                key={wb.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="truncate text-xs text-white">
                    {wb.sourceLabel}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {wb.assignedContributorIds.length > 0 ? (
                    <span className="text-[10px] text-text-secondary">
                      · {wb.assignedContributorIds.length} assigned
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpenDiscovery}
        className="text-xs text-brand-teal hover:underline"
      >
        Manage workbooks on the Discovery tab →
      </button>
    </div>
  );
}
