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
  const approvalCount = useMemo(
    () => queue.filter((task) => task.approvalRequired).length,
    [queue]
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
              <Sparkles size={14} /> Skippy operator
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Command centre</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-2">
              {data?.synthesis ?? "No synthesis yet — import notes or generate next actions to build the project command thread."}
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

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Execution queue</h3>
            <span className="rounded-full border border-ink-4 px-2 py-0.5 text-xs text-text-2">{approvalCount} Approval required</span>
          </div>
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((task) => (
                <div key={task.id} className="rounded-[12px] border border-ink-4 bg-black/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <span className="text-xs text-text-3">{task.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-2">
                    {task.executionReadiness ?? "not_ready"} · {task.taskOrigin ?? "manual"}
                    {task.approvalRequired ? " · Approval required" : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-2">No active execution tasks yet.</p>
          )}
        </section>

        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={15} /> HubSpot guardrails
          </h3>
          <p className="text-sm text-text-2">{data?.hubspotGuardrails?.posture ?? "Dry-run first. Approval before writes."}</p>
          <div className="mt-3 space-y-2 text-xs text-text-2">
            <p><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-status-success" /> Dry-run first for portal checks.</p>
            <p><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-status-warning" /> Client data, properties, workflows and portal writes need approval.</p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Meeting intelligence</h3>
          {(data?.meetingIntelligence?.latestNotes ?? []).length > 0 ? (
            <div className="space-y-2">
              {data?.meetingIntelligence?.latestNotes.map((note) => (
                <div key={note.id} className="rounded-[12px] border border-ink-4 bg-black/10 p-3">
                  <p className="text-sm font-medium text-white">{note.title}</p>
                  <p className="text-xs text-text-3">{note.meetingDate ?? "No date"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-2">No meeting notes imported yet.</p>
          )}
        </section>

        <section className="rounded-[16px] border border-ink-4 bg-ink-2 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Risks and blockers</h3>
          {(data?.risks ?? []).length > 0 ? (
            <div className="space-y-2">
              {data?.risks?.map((risk) => (
                <div key={risk.id} className="rounded-[12px] border border-ink-4 bg-black/10 p-3">
                  <p className="text-sm font-medium text-white">{risk.title}</p>
                  <p className="text-xs text-text-3">{risk.severity ?? "medium"} · {risk.status ?? "open"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-2">No open risks logged. Suspiciously calm, but we’ll take it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
