"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function DiscoveryTab(props: {
  projectId: string;
  sessionsTracker: ReactNode;
  progressSummary: ReactNode;
  notesPreview: ReactNode;
  workbooksPanel?: ReactNode;
  sessionsCount: number;
  onOpenAccessSharing: () => void;
}) {
  // T3 chase mechanics — surface overdue workbooks at the top of the
  // Discovery tab. The badge only shows when there are overdue workbooks
  // with unanswered questions, so it stays out of the way otherwise.
  const [overdue, setOverdue] = useState<{
    overdueCount: number;
    oldestDueDate: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${props.projectId}/discovery/overdue-summary`,
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
  }, [props.projectId]);

  return (
    <div className="space-y-6">
      {overdue && overdue.overdueCount > 0 ? (
        <section className="rounded-[14px] border border-status-error/40 bg-status-error/10 p-4">
          <p className="text-sm font-semibold text-rose-100">
            {overdue.overdueCount} workbook
            {overdue.overdueCount === 1 ? "" : "s"} overdue
          </p>
          <p className="mt-1 text-xs text-rose-200/80">
            Each overdue workbook still has unanswered questions. Set a new
            due date or chase the contributor to clear it from this strip.
            {overdue.oldestDueDate
              ? ` Oldest due date: ${new Date(
                  overdue.oldestDueDate
                ).toLocaleDateString()}.`
              : null}
          </p>
        </section>
      ) : null}

      <section className="brand-surface-soft rounded-[14px] border border-ink-4 p-4">
        <p className="text-xs leading-relaxed text-text-2">
          Discovery is for the workbooks, sessions and notes that scope this
          engagement. Contributors, HubSpot, Miro boards and shared
          resources have moved to{" "}
          <button
            type="button"
            onClick={props.onOpenAccessSharing}
            className="font-medium text-brand-teal hover:underline"
          >
            Access &amp; Sharing
          </button>
          . Reusable workbook templates and the global question library are
          managed under{" "}
          <a
            href="/workbooks"
            className="font-medium text-brand-teal hover:underline"
          >
            Operations → Workbooks
          </a>{" "}
          and{" "}
          <a
            href="/question-library"
            className="font-medium text-brand-teal hover:underline"
          >
            Operations → Question library
          </a>
          .
        </p>
      </section>

      {/* T3 — Workbooks lead the Discovery surface. They are how the team
          actually pulls answers out of clients these days; sessions are the
          legacy ritual frame. */}
      {props.workbooksPanel ? (
        <section className="brand-surface rounded-[14px] border p-6">
          <h3 className="text-lg font-semibold text-white">
            Discovery workbooks
          </h3>
          <p className="mt-1 text-xs text-text-2">
            Primary surface — give each workbook an owner and a due date so
            the chase mechanics can light up what is overdue.
          </p>
          <div className="mt-4">{props.workbooksPanel}</div>
        </section>
      ) : null}

      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-2">
          Ritual sessions
        </h3>
        <p className="mt-1 text-xs text-text-2">
          {props.sessionsCount} session
          {props.sessionsCount === 1 ? "" : "s"} planned. Sessions remain
          the structured ritual frame; day-to-day capture happens in the
          workbooks above.
        </p>
        <div className="mt-4">{props.sessionsTracker}</div>
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-lg font-semibold text-white">Discovery progress</h3>
        <div className="mt-4">{props.progressSummary}</div>
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-lg font-semibold text-white">Prepare notes preview</h3>
        <div className="mt-4">{props.notesPreview}</div>
      </section>
    </div>
  );
}
