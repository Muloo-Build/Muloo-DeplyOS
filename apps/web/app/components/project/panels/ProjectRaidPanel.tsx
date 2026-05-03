"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

type Risk = {
  id: string;
  kind: "risk" | "issue" | "decision" | "assumption";
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "monitoring" | "mitigated" | "closed";
  owner: string | null;
  dueDate: string | null;
  mitigation: string | null;
  createdAt: string;
};

const KINDS: Risk["kind"][] = ["risk", "issue", "decision", "assumption"];
const SEVERITIES: Risk["severity"][] = ["low", "medium", "high", "critical"];
const STATUSES: Risk["status"][] = ["open", "monitoring", "mitigated", "closed"];

const SEVERITY_TONE: Record<Risk["severity"], string> = {
  low: "bg-emerald-500/20 text-emerald-200",
  medium: "bg-amber-500/20 text-amber-200",
  high: "bg-orange-500/30 text-orange-100",
  critical: "bg-rose-500/30 text-rose-100"
};

const STATUS_TONE: Record<Risk["status"], string> = {
  open: "bg-rose-500/20 text-rose-100",
  monitoring: "bg-amber-500/20 text-amber-100",
  mitigated: "bg-emerald-500/20 text-emerald-100",
  closed: "bg-white/10 text-text-secondary"
};

export default function ProjectRaidPanel({ projectId }: { projectId: string }) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    kind: "risk" as Risk["kind"],
    title: "",
    description: "",
    severity: "medium" as Risk["severity"],
    owner: "",
    dueDate: ""
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/risks`, {
        credentials: "include"
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed");
      setRisks(body.risks ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/risks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dueDate: form.dueDate || null })
    });
    if (r.ok) {
      setForm({
        kind: "risk",
        title: "",
        description: "",
        severity: "medium",
        owner: "",
        dueDate: ""
      });
      setAdding(false);
      await load();
    }
  }

  async function updateStatus(id: string, status: Risk["status"]) {
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/risks/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/risks/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );
    await load();
  }

  const open = risks.filter((r) => r.status === "open" || r.status === "monitoring");
  const closed = risks.filter((r) => r.status === "mitigated" || r.status === "closed");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary">RAID log</p>
          <p className="text-sm text-white">
            {open.length} open · {closed.length} resolved
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      </div>

      {adding ? (
        <form
          onSubmit={submit}
          className="grid gap-2 rounded-2xl border border-white/10 bg-background-elevated p-4 md:grid-cols-6"
        >
          <select
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white"
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as Risk["kind"] })
            }
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Title"
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white md:col-span-3"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white"
            value={form.severity}
            onChange={(e) =>
              setForm({ ...form, severity: e.target.value as Risk["severity"] })
            }
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <input
            placeholder="Owner"
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white md:col-span-2"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          />
          <textarea
            placeholder="Description (optional)"
            className="rounded-md border border-white/10 bg-background-card px-2 py-1.5 text-sm text-white md:col-span-4"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button
            type="submit"
            className="rounded-md bg-status-warning/90 px-3 py-1.5 text-sm font-semibold text-background-card hover:bg-status-warning"
          >
            Save
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-status-error">{error}</p> : null}
      {loading ? (
        <p className="text-xs text-text-secondary">Loading…</p>
      ) : risks.length === 0 ? (
        <p className="text-xs text-text-secondary">
          No risks, issues, decisions, or assumptions logged yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
          {risks.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                      {r.kind}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${SEVERITY_TONE[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_TONE[r.status]}`}
                    >
                      {r.status}
                    </span>
                    {r.dueDate ? (
                      <span className="text-[10px] text-text-secondary">
                        due {r.dueDate.slice(0, 10)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-white">
                    {r.kind === "risk" || r.kind === "issue" ? (
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
                    ) : null}
                    {r.title}
                  </p>
                  {r.description ? (
                    <p className="mt-1 text-xs text-text-secondary">{r.description}</p>
                  ) : null}
                  {r.owner ? (
                    <p className="mt-1 text-[11px] text-text-secondary">
                      Owner: {r.owner}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <select
                    value={r.status}
                    onChange={(e) =>
                      void updateStatus(r.id, e.target.value as Risk["status"])
                    }
                    className="rounded-md border border-white/10 bg-background-card px-2 py-1 text-xs text-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void remove(r.id)}
                    className="text-text-secondary hover:text-status-error"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
