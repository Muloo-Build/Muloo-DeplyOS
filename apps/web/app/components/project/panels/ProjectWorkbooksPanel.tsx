"use client";

import { useCallback, useEffect, useState } from "react";

interface Workbook {
  id: string;
  projectId: string;
  evidenceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  kind: string | null;
  workstreamId: string | null;
  status: string | null;
  ownerName: string | null;
  sharedWith: string[];
  dueDate: string | null;
  linkedSectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface WorkstreamOption {
  id: string;
  name: string;
}

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  "uploaded-doc": "Doc / Sheet / PDF",
  "website-link": "Link",
  "miro-note": "Miro",
  "operator-note": "Note",
  "client-input": "Form"
};

const EVIDENCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "uploaded-doc", label: "Google Doc / Sheet / PDF" },
  { value: "website-link", label: "Link" },
  { value: "miro-note", label: "Miro board" },
  { value: "operator-note", label: "Internal note" },
  { value: "client-input", label: "Form / questionnaire" }
];

const STATUS_OPTIONS = [
  "draft",
  "shared",
  "in_progress",
  "submitted",
  "needs_review",
  "approved"
];

export default function ProjectWorkbooksPanel(props: {
  projectId: string;
  workstreams: WorkstreamOption[];
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    sourceLabel: "",
    sourceUrl: "",
    evidenceType: "uploaded-doc",
    workstreamId: "",
    status: "draft",
    ownerName: "",
    content: ""
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${props.projectId}/workbooks`, {
        credentials: "include"
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setWorkbooks(data.workbooks ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workbooks");
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWorkbook() {
    if (!draft.sourceLabel.trim()) {
      setError("Workbook name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${props.projectId}/workbooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: draft.sourceLabel.trim(),
          sourceUrl: draft.sourceUrl.trim() || null,
          evidenceType: draft.evidenceType,
          workstreamId: draft.workstreamId || null,
          status: draft.status,
          ownerName: draft.ownerName.trim() || null,
          content: draft.content.trim() || null,
          sessionNumber: 0
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to create workbook");
      }
      setDraft({
        sourceLabel: "",
        sourceUrl: "",
        evidenceType: "uploaded-doc",
        workstreamId: "",
        status: "draft",
        ownerName: "",
        content: ""
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkbook(id: string) {
    if (!confirm("Delete this workbook?")) return;
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          External Google Sheets, Docs, PDFs, or forms shared with stakeholders.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide text-white"
        >
          {showForm ? "Cancel" : "Add workbook"}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {showForm ? (
        <div className="brand-surface-soft space-y-3 rounded-2xl border p-4">
          <input
            type="text"
            value={draft.sourceLabel}
            onChange={(e) =>
              setDraft({ ...draft, sourceLabel: e.target.value })
            }
            placeholder="Workbook name"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="url"
            value={draft.sourceUrl}
            onChange={(e) =>
              setDraft({ ...draft, sourceUrl: e.target.value })
            }
            placeholder="https://docs.google.com/..."
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={draft.evidenceType}
              onChange={(e) =>
                setDraft({ ...draft, evidenceType: e.target.value })
              }
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            >
              {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={draft.workstreamId}
              onChange={(e) =>
                setDraft({ ...draft, workstreamId: e.target.value })
              }
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">No linked workstream</option>
              {props.workstreams.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draft.ownerName}
              onChange={(e) =>
                setDraft({ ...draft, ownerName: e.target.value })
              }
              placeholder="Owner (e.g. Tara)"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="Notes (optional)"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
          <button
            type="button"
            disabled={busy}
            onClick={createWorkbook}
            className="brand-primary rounded-full px-4 py-2 text-sm"
          >
            {busy ? "Saving…" : "Save workbook"}
          </button>
        </div>
      ) : null}

      {!workbooks ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : workbooks.length === 0 ? (
        <p className="text-sm text-text-secondary">No workbooks yet.</p>
      ) : (
        <ul className="space-y-2">
          {workbooks.map((wb) => {
            const workstream = props.workstreams.find(
              (ws) => ws.id === wb.workstreamId
            );
            return (
              <li
                key={wb.id}
                className="brand-surface-soft rounded-2xl border p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {wb.sourceLabel}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {EVIDENCE_TYPE_LABEL[wb.evidenceType] ?? wb.evidenceType}
                      {wb.status ? ` · ${wb.status}` : ""}
                      {wb.ownerName ? ` · owner ${wb.ownerName}` : ""}
                      {workstream ? ` · ${workstream.name}` : ""}
                    </p>
                    {wb.sourceUrl ? (
                      <a
                        href={wb.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-brand-teal hover:underline"
                      >
                        Open ↗
                      </a>
                    ) : null}
                    {wb.content ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        {wb.content}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWorkbook(wb.id)}
                    className="text-xs text-text-secondary hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
