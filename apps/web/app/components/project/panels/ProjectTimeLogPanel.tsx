"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Clock } from "lucide-react";

type Entry = {
  id: string;
  taskId: string | null;
  userEmail: string;
  userName: string | null;
  hours: number;
  occurredOn: string;
  notes: string | null;
  billable: boolean;
};

type Totals = {
  totalHours: number;
  entryCount: number;
  byUser: Array<{ userEmail: string; userName: string | null; hours: number }>;
};

export default function ProjectTimeLogPanel({
  projectId,
  tasks = []
}: {
  projectId: string;
  tasks?: Array<{ id: string; title: string }>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    userEmail: "",
    userName: "",
    hours: "",
    occurredOn: today,
    taskId: "",
    notes: "",
    billable: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/time-entries`, {
        credentials: "include"
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed to load");
      setEntries(body.entries ?? []);
      setTotals(body.totals ?? null);
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
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/time-entries`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: form.userEmail.trim(),
          userName: form.userName.trim() || null,
          hours: Number(form.hours),
          occurredOn: form.occurredOn,
          taskId: form.taskId || null,
          notes: form.notes.trim() || null,
          billable: form.billable
        })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed");
      setForm((f) => ({ ...f, hours: "", notes: "", taskId: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/time-entries/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" }
    );
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-2">Time logged</p>
          <p className="text-2xl font-semibold text-white">
            {(totals?.totalHours ?? 0).toFixed(1)}h
            <span className="ml-2 text-xs text-text-2">
              · {totals?.entryCount ?? 0} entries · last 60 days
            </span>
          </p>
        </div>
        {totals && totals.byUser.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {totals.byUser.slice(0, 4).map((u) => (
              <span
                key={u.userEmail}
                className="rounded-full border border-ink-4 bg-white/5 px-2.5 py-1 text-xs text-text-2"
              >
                {u.userName ?? u.userEmail.split("@")[0]}: {u.hours.toFixed(1)}h
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={submit}
        className="grid gap-2 rounded-[14px] border border-ink-4 bg-ink-2 p-4 md:grid-cols-6"
      >
        <input
          required
          type="email"
          placeholder="you@muloo.io"
          className="rounded-md border border-ink-4 bg-ink-1 px-2 py-1.5 text-sm text-white md:col-span-2"
          value={form.userEmail}
          onChange={(e) => setForm({ ...form, userEmail: e.target.value })}
        />
        <input
          required
          type="number"
          step="0.25"
          min="0.25"
          max="24"
          placeholder="Hours"
          className="rounded-md border border-ink-4 bg-ink-1 px-2 py-1.5 text-sm text-white"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
        <input
          type="date"
          className="rounded-md border border-ink-4 bg-ink-1 px-2 py-1.5 text-sm text-white"
          value={form.occurredOn}
          onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
        />
        <select
          className="rounded-md border border-ink-4 bg-ink-1 px-2 py-1.5 text-sm text-white md:col-span-2"
          value={form.taskId}
          onChange={(e) => setForm({ ...form, taskId: e.target.value })}
        >
          <option value="">No task linked</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <input
          placeholder="Notes (optional)"
          className="rounded-md border border-ink-4 bg-ink-1 px-2 py-1.5 text-sm text-white md:col-span-5"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-status-warning/90 px-3 py-1.5 text-sm font-semibold text-background-card hover:bg-status-warning disabled:opacity-60"
        >
          {saving ? "Logging…" : "Log time"}
        </button>
      </form>

      {error ? (
        <p className="text-xs text-status-error">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-xs text-text-2">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-text-2">No time logged yet.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-[14px] border border-ink-4">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm text-white">
                  <Clock className="mr-1 inline h-3.5 w-3.5 text-text-2" />
                  <strong>{e.hours.toFixed(2)}h</strong>{" "}
                  <span className="text-text-2">
                    by {e.userName ?? e.userEmail.split("@")[0]} on {e.occurredOn}
                  </span>
                </p>
                {e.notes ? (
                  <p className="mt-1 text-xs text-text-2">{e.notes}</p>
                ) : null}
              </div>
              <button
                onClick={() => void remove(e.id)}
                className="text-text-2 hover:text-status-error"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
