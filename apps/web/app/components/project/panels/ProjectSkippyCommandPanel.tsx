"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

type CommandCentre = {
  project?: { id: string; name: string; client?: { name?: string } | null; portal?: { connected?: boolean; portalId?: string | null } | null } | null;
  synthesis?: string;
  nextActions?: string[];
  executionQueue?: Array<{ id: string; title: string; status: string; approvalRequired?: boolean; executionReadiness?: string; taskOrigin?: string | null }>;
  risks?: Array<{ id: string; title: string; severity?: string; status?: string }>;
  meetingIntelligence?: { latestNotes: Array<{ id: string; title: string; meetingDate?: string; links?: string[] }>; importedTaskCount: number };
  hubspotGuardrails?: { portalConnected: boolean; posture: string; allowed: string[]; requiresApproval: string[] };
};

const safeActionLabels = [
  "Draft internal note",
  "Prepare HubSpot dry-run",
  "Summarise meeting evidence",
  "Generate approval-gated task"
];

export default function ProjectSkippyCommandPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CommandCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/skippy/command-centre`,
        { credentials: "include" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Failed to load Skippy command centre");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Skippy command centre");
    } finally {
      setLoading(false);
    }
  }

  async function importGeminiNotes() {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const latest = data?.meetingIntelligence?.latestNotes?.[0];
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/gemini/import`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "manual_gemini_import",
            sourceMeetingNoteId: latest?.id,
            sourceTitle: latest?.title,
            tasks: [
              {
                title: latest
                  ? `[Gemini] Review ${latest.title}`
                  : "[Gemini] Review imported meeting intelligence",
                description: "Review the imported Gemini meeting intelligence, confirm next actions, and link source evidence before client-facing changes."
              }
            ]
          })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Gemini import failed");
      setMessage(`Imported ${body?.createdTasks?.length ?? 0} approval-gated Gemini task(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini import failed");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  const queue = data?.executionQueue ?? [];
  const risks = data?.risks ?? [];
  const nextActions = (data?.nextActions ?? []).slice(0, 3);
  const approvalTasks = useMemo(
    () => queue.filter((task) => task.approvalRequired),
    [queue]
  );
  const blockedItems = useMemo(
    () => [
      ...queue.filter((task) => task.status === "blocked").map((task) => task.title),
      ...risks.map((risk) => risk.title)
    ].slice(0, 4),
    [queue, risks]
  );

  if (loading) {
    return <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-5 text-sm text-text-2">Loading Skippy command centre…</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-[10px] border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">{error}</p> : null}
      {message ? <p className="rounded-[10px] border border-status-success/40 bg-status-success/10 p-3 text-sm text-status-success">{message}</p> : null}

      <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-status-warning">
              <Sparkles size={14} /> Skippy operator · Execution queue
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Command centre</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-2">
              One surface for state, next actions, approvals, blockers and safe Skippy moves. No dashboard soup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-4 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void importGeminiNotes()}
              disabled={importing}
              className="rounded-md bg-status-warning/90 px-3 py-1.5 text-xs font-semibold text-background-card hover:bg-status-warning disabled:opacity-60"
            >
              {importing ? "Importing…" : "Import Gemini notes"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Current state</h3>
          <p className="text-sm leading-6 text-text-2">
            {data?.synthesis ?? "No synthesis yet — import meeting notes or create reviewed tasks to build the project command thread."}
          </p>
          <p className="mt-3 text-xs text-text-3">
            Gemini imports: {data?.meetingIntelligence?.importedTaskCount ?? 0} task(s) · Portal {data?.hubspotGuardrails?.portalConnected ? "connected" : "not connected"}
          </p>
        </section>

        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Next actions</h3>
          {nextActions.length > 0 ? (
            <ol className="space-y-2 text-sm text-text-2">
              {nextActions.map((action, index) => (
                <li key={action} className="flex gap-2">
                  <span className="text-status-warning">{index + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-2">No next actions yet. Import evidence first, then let Skippy shape the queue.</p>
          )}
        </section>

        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={15} /> Needs approval
          </h3>
          <p className="mb-3 text-xs text-text-3">Approval required before HubSpot writes or client-visible changes.</p>
          {approvalTasks.length > 0 ? (
            <div className="space-y-2">
              {approvalTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-[12px] border border-ink-4 bg-black/10 p-3">
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  <p className="mt-1 text-xs text-text-3">{task.executionReadiness ?? "ready_with_review"} · {task.taskOrigin ?? "manual"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-2">No approval-required execution tasks currently queued.</p>
          )}
        </section>

        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle size={15} /> Blocked
          </h3>
          {blockedItems.length > 0 ? (
            <ul className="space-y-2 text-sm text-text-2">
              {blockedItems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-text-2">No open blockers logged. Suspiciously calm, but we’ll take it.</p>
          )}
        </section>
      </div>

      <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 size={15} /> Safe actions · HubSpot guardrails
        </h3>
        <p className="text-sm text-text-2">{data?.hubspotGuardrails?.posture ?? "Dry-run first. Approval before writes."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {safeActionLabels.map((label) => (
            <span key={label} className="rounded-full border border-ink-4 bg-black/10 px-3 py-1 text-xs text-text-2">
              {label}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-3">
          HubSpot writes, client-visible changes, properties, pipelines, workflows, lists and sent communications still require approval.
        </p>
      </section>
    </div>
  );
}
