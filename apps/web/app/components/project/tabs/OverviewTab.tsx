"use client";

import { useEffect, useState, type ReactNode } from "react";

function OverviewCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="brand-surface rounded-3xl border p-6">
      <h3 className="text-lg font-semibold text-white">{props.title}</h3>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

// T3 chase mechanics — Project Overview surface for overdue discovery
// workbooks. Same data source as the chip on the Discovery tab and the
// Command Centre attention strip; rendered here so the overdue signal is
// visible the moment an operator opens the project, not buried under the
// Discovery sub-tab.
function ProjectDiscoveryOverdueAlert({ projectId }: { projectId: string }) {
  const [overdue, setOverdue] = useState<{
    overdueCount: number;
    oldestDueDate: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/discovery/overdue-summary`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          summary?: { overdueCount: number; oldestDueDate: string | null };
        };
        if (!cancelled && data.summary) setOverdue(data.summary);
      } catch {
        /* silent — chase widget is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!overdue || overdue.overdueCount === 0) return null;
  return (
    <section className="rounded-3xl border border-status-error/40 bg-status-error/10 p-5">
      <p className="text-sm font-semibold text-rose-100">
        {overdue.overdueCount} discovery workbook
        {overdue.overdueCount === 1 ? "" : "s"} overdue
      </p>
      <p className="mt-1 text-xs text-rose-200/80">
        Each overdue workbook still has unanswered questions. Open the
        Discovery tab to chase the owner or push out the due date.
        {overdue.oldestDueDate
          ? ` Oldest due date: ${new Date(
              overdue.oldestDueDate
            ).toLocaleDateString()}.`
          : null}
      </p>
    </section>
  );
}

export default function OverviewTab(props: {
  statusCard: ReactNode;
  workstreamSummary: ReactNode;
  inputsSummary: ReactNode;
  blueprintStatus: ReactNode;
  agentSummary: ReactNode;
  quickWins: ReactNode;
  clientAccess: ReactNode;
  partnerAccess: ReactNode;
  readinessSummary?: ReactNode;
  projectId?: string;
}) {
  return (
    <div className="space-y-6">
      {props.projectId ? (
        <ProjectDiscoveryOverdueAlert projectId={props.projectId} />
      ) : null}
      {props.readinessSummary ? (
        <OverviewCard title="Project readiness">
          {props.readinessSummary}
        </OverviewCard>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <OverviewCard title="Client access">{props.clientAccess}</OverviewCard>
        <OverviewCard title="Partner access">{props.partnerAccess}</OverviewCard>
      </div>
      <OverviewCard title="Project status">{props.statusCard}</OverviewCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <OverviewCard title="Workstreams">{props.workstreamSummary}</OverviewCard>
        <OverviewCard title="Human inputs">{props.inputsSummary}</OverviewCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <OverviewCard title="Blueprint status">{props.blueprintStatus}</OverviewCard>
        <OverviewCard title="Quick wins">{props.quickWins}</OverviewCard>
      </div>
      <OverviewCard title="Agent summary">{props.agentSummary}</OverviewCard>
    </div>
  );
}
