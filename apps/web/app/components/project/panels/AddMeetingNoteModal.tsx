"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

type WorkstreamOption = { id: string; name: string };
type WorkbookOption = { id: string; sourceLabel: string };

export default function AddMeetingNoteModal({
  open,
  projectId,
  workstreams,
  workbooks,
  onClose,
  onSaved
}: {
  open: boolean;
  projectId: string;
  workstreams: WorkstreamOption[];
  workbooks: WorkbookOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [links, setLinks] = useState("");
  const [relatedWorkstreamId, setRelatedWorkstreamId] = useState("");
  const [relatedWorkbookId, setRelatedWorkbookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setMeetingDate(new Date().toISOString().slice(0, 10));
      setAttendees("");
      setNotes("");
      setTranscript("");
      setLinks("");
      setRelatedWorkstreamId("");
      setRelatedWorkbookId("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/meeting-notes`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            meetingDate,
            attendees: attendees
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean),
            notes,
            transcript,
            links: links
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean),
            relatedWorkstreamId: relatedWorkstreamId || null,
            relatedWorkbookId: relatedWorkbookId || null
          })
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Save failed (${response.status})`);
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to save meeting"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-background-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Add latest meeting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-text-secondary">
          Capture meeting notes against this project. You'll be able to convert
          them into tasks, workbook questions, and follow-ups from the Meetings
          tab.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-text-secondary">
              Meeting title *
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Discovery kick-off with Magnisol"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-text-secondary">
                Date
              </span>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-text-secondary">
                Attendees (comma or newline separated)
              </span>
              <input
                type="text"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Tara, Grant, Devan"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-text-secondary">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Key points, decisions, follow-ups..."
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-text-secondary">
              Transcript (optional)
            </span>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Paste full transcript if available"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-text-secondary">
              Links mentioned (one per line or comma-separated)
            </span>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={2}
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="https://miro.com/app/board/..."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-text-secondary">
                Related workstream (optional)
              </span>
              <select
                value={relatedWorkstreamId}
                onChange={(e) => setRelatedWorkstreamId(e.target.value)}
                className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {workstreams.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-text-secondary">
                Related workbook (optional)
              </span>
              <select
                value={relatedWorkbookId}
                onChange={(e) => setRelatedWorkbookId(e.target.value)}
                className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {workbooks.map((wb) => (
                  <option key={wb.id} value={wb.id}>
                    {wb.sourceLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Save meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
