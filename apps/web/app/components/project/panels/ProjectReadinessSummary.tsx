"use client";

import { useEffect, useState } from "react";

interface WorkstreamHourRow {
  workstreamId: string;
  name: string;
  hourCap: number | null;
  actualHours: number;
  scopeRisk: "low" | "medium" | "high" | null;
}

interface WorkbookSection {
  id: string;
  questions?: Array<{ status?: string }>;
}

interface Workbook {
  id: string;
  status: string | null;
  resourceType?: string | null;
  workbookContent?: { sections?: WorkbookSection[] } | null;
}

interface Contributor {
  id: string;
  role: string;
  portalAccess: boolean;
}

interface ChangeRequest {
  id: string;
  status: string;
}

interface ReadinessProps {
  projectId: string;
  billingOwner: string | null;
  deliveryOwner: string | null;
  partnerName: string | null;
}

export default function ProjectReadinessSummary(props: ReadinessProps) {
  const [hours, setHours] = useState<WorkstreamHourRow[]>([]);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${props.projectId}/workstream-hours`, {
        credentials: "include"
      }).then((r) => r.json()),
      fetch(`/api/projects/${props.projectId}/workbooks`, {
        credentials: "include"
      }).then((r) => r.json()),
      fetch(`/api/projects/${props.projectId}/contributors`, {
        credentials: "include"
      }).then((r) => r.json()),
      fetch(
        `/api/work-requests?projectId=${encodeURIComponent(props.projectId)}`,
        { credentials: "include" }
      )
        .then((r) => r.json())
        .catch(() => ({}))
    ])
      .then(([hrs, wb, cb, cr]) => {
        if (cancelled) return;
        setHours(hrs?.workstreamHours ?? []);
        setWorkbooks(wb?.workbooks ?? []);
        setContributors(cb?.contributors ?? []);
        setChangeRequests(
          cr?.workRequests?.filter(
            (req: ChangeRequest & { requestType?: string }) =>
              (req as { requestType?: string }).requestType === "change_request"
          ) ?? []
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading readiness…</p>;
  }

  const completedWorkbooks = workbooks.filter(
    (wb) => wb.status === "approved" || wb.status === "submitted"
  ).length;
  const sharedWorkbooks = workbooks.filter(
    (wb) =>
      wb.status === "shared" ||
      wb.status === "in_progress" ||
      wb.status === "needs_review"
  ).length;
  const draftWorkbooks = workbooks.filter(
    (wb) => !wb.status || wb.status === "draft"
  ).length;
  const miroBoards = workbooks.filter(
    (wb) => wb.resourceType === "miro_board"
  );

  let questionsTotal = 0;
  let questionsAnswered = 0;
  workbooks.forEach((wb) => {
    (wb.workbookContent?.sections ?? []).forEach((section) => {
      (section.questions ?? []).forEach((q) => {
        questionsTotal += 1;
        if (q.status === "answered" || q.status === "approved") {
          questionsAnswered += 1;
        }
      });
    });
  });
  const questionsUnanswered = questionsTotal - questionsAnswered;

  const overCapWorkstreams = hours.filter(
    (h) => h.hourCap !== null && h.actualHours > h.hourCap
  );
  const atRiskWorkstreams = hours.filter((h) => h.scopeRisk === "high");

  const pendingChanges = changeRequests.filter(
    (cr) =>
      cr.status === "new" ||
      cr.status === "under_review" ||
      cr.status === "priced"
  );

  const stats = [
    {
      label: "Workstreams",
      value: String(hours.length),
      detail: hours.length === 0 ? "Add workstreams" : null
    },
    {
      label: "Workbooks",
      value: String(workbooks.length),
      detail: `${completedWorkbooks} done · ${sharedWorkbooks} shared · ${draftWorkbooks} draft`
    },
    {
      label: "Contributors",
      value: String(contributors.length),
      detail: `${contributors.filter((c) => c.portalAccess).length} with portal`
    },
    {
      label: "Questions",
      value: questionsTotal === 0 ? "—" : `${questionsAnswered}/${questionsTotal}`,
      detail:
        questionsTotal === 0
          ? "No structured workbooks"
          : `${questionsUnanswered} unanswered`
    },
    {
      label: "Miro boards",
      value: String(miroBoards.length),
      detail: miroBoards.length === 0 ? "Not linked" : null
    },
    {
      label: "Pending changes",
      value: String(pendingChanges.length),
      detail: pendingChanges.length > 0 ? "Awaiting decision" : null
    }
  ];

  const ownership: Array<{ label: string; value: string | null }> = [
    { label: "Billing owner", value: props.billingOwner },
    { label: "Delivery owner", value: props.deliveryOwner },
    { label: "Partner", value: props.partnerName }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="brand-surface-soft rounded-2xl border p-3"
          >
            <p className="text-xs uppercase tracking-wide text-text-secondary">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
            {stat.detail ? (
              <p className="text-[11px] text-text-secondary">{stat.detail}</p>
            ) : null}
          </div>
        ))}
      </div>

      {ownership.some((o) => o.value) ? (
        <div className="brand-surface-soft flex flex-wrap gap-3 rounded-2xl border p-3 text-xs">
          {ownership
            .filter((o) => o.value)
            .map((o) => (
              <span key={o.label}>
                <span className="text-text-secondary">{o.label}:</span>{" "}
                <span className="text-white">{o.value}</span>
              </span>
            ))}
        </div>
      ) : null}

      {overCapWorkstreams.length > 0 || atRiskWorkstreams.length > 0 ? (
        <div className="space-y-1 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
            Scope risk
          </p>
          {overCapWorkstreams.map((ws) => (
            <p key={ws.workstreamId} className="text-xs text-rose-200">
              {ws.name} · {ws.actualHours.toFixed(1)}h used vs {ws.hourCap}h cap
            </p>
          ))}
          {atRiskWorkstreams
            .filter(
              (ws) =>
                !overCapWorkstreams.some(
                  (over) => over.workstreamId === ws.workstreamId
                )
            )
            .map((ws) => (
              <p key={ws.workstreamId} className="text-xs text-rose-200">
                {ws.name} · marked high risk
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
