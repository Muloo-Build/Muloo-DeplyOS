"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Sparkles, Trash2 } from "lucide-react";
import AddMeetingNoteModal from "./AddMeetingNoteModal";

type ExtractedAction = { title?: string; owner?: string; dueDate?: string };
type ExtractedDecision = { title?: string; context?: string };
type ExtractedRisk = { title?: string; severity?: string; description?: string };

type MeetingNote = {
  id: string;
  title: string;
  meetingDate: string;
  attendees: string[];
  notes: string;
  transcript: string;
  links: string[];
  relatedWorkstreamId: string | null;
  relatedWorkbookId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  extractedActions?: ExtractedAction[] | null;
  extractedDecisions?: ExtractedDecision[] | null;
  extractedRisks?: ExtractedRisk[] | null;
  extractedAt?: string | null;
};

type WorkstreamOption = { id: string; name: string };
type WorkbookOption = { id: string; sourceLabel: string };

export default function ProjectMeetingsPanel({
  projectId,
  workstreams = [],
  workbooks = [],
  modalOpen,
  setModalOpen
}: {
  projectId: string;
  workstreams?: WorkstreamOption[];
  workbooks?: WorkbookOption[];
  modalOpen?: boolean;
  setModalOpen?: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  const open = modalOpen ?? internalOpen;
  const setOpen = setModalOpen ?? setInternalOpen;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/meeting-notes`,
        { credentials: "include" }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to load meetings");
      }
      setNotes(Array.isArray(body.notes) ? body.notes : []);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to load meetings"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  async function extract(noteId: string) {
    setExtractingId(noteId);
    setExtractError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/meeting-notes/${encodeURIComponent(noteId)}/extract`,
        { method: "POST", credentials: "include" }
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Extract failed");
      await load();
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Failed");
    } finally {
      setExtractingId(null);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this meeting note?")) return;
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/meeting-notes/${encodeURIComponent(noteId)}`,
      { method: "DELETE", credentials: "include" }
    );
    if (response.ok) {
      void load();
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Meeting notes</h2>
          <p className="text-xs text-text-2">
            Capture meeting notes and turn them into tasks, questions, or
            follow-ups from this tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          <CalendarPlus size={16} />
          Add latest meeting
        </button>
      </header>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-2">Loading meetings…</p>
      ) : notes.length === 0 ? (
        <div className="brand-surface rounded-[14px] border border-dashed border-ink-4 p-8 text-center">
          <p className="text-sm text-white">No meetings yet</p>
          <p className="mt-1 text-xs text-text-2">
            Add your latest client meeting notes and Deploy OS will help turn
            them into tasks, risks, questions, and scope updates.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <CalendarPlus size={16} />
            Add latest meeting
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="brand-surface rounded-[14px] border border-ink-4 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {note.title}
                  </h3>
                  <p className="mt-1 text-xs text-text-2">
                    {new Date(note.meetingDate).toLocaleDateString()} ·{" "}
                    {note.attendees.length > 0
                      ? note.attendees.join(", ")
                      : "No attendees recorded"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNote(note.id)}
                  className="rounded-md p-1 text-text-2 hover:bg-white/5 hover:text-red-300"
                  aria-label="Delete meeting"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {note.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-white/90">
                  {note.notes}
                </p>
              ) : null}
              {note.links.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {note.links.map((link, idx) => (
                    <a
                      key={`${note.id}-link-${idx}`}
                      href={link}
                      target="_blank"
                      rel="noopener"
                      className="rounded-full border border-ink-4 bg-white/5 px-2 py-1 text-[11px] text-brand-teal hover:underline"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void extract(note.id)}
                  disabled={extractingId === note.id}
                  className="inline-flex items-center gap-1 rounded-md border border-ink-4 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-60"
                >
                  <Sparkles size={12} className="text-amber-300" />
                  {extractingId === note.id
                    ? "Extracting…"
                    : note.extractedAt
                      ? "Re-extract"
                      : "Extract actions / decisions / risks"}
                </button>
                {note.extractedAt ? (
                  <span className="text-[11px] text-text-2">
                    Last extracted{" "}
                    {new Date(note.extractedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
              {extractError && extractingId === null ? (
                <p className="mt-2 text-[11px] text-status-error">{extractError}</p>
              ) : null}
              {(note.extractedActions?.length ?? 0) +
                (note.extractedDecisions?.length ?? 0) +
                (note.extractedRisks?.length ?? 0) >
              0 ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-ink-4 bg-ink-2 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-text-2">
                      Actions ({note.extractedActions?.length ?? 0})
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-white">
                      {(note.extractedActions ?? []).map((a, i) => (
                        <li key={i}>
                          • {a.title}
                          {a.owner ? ` — ${a.owner}` : ""}
                          {a.dueDate ? ` (${a.dueDate})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-ink-4 bg-ink-2 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-text-2">
                      Decisions ({note.extractedDecisions?.length ?? 0})
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-white">
                      {(note.extractedDecisions ?? []).map((d, i) => (
                        <li key={i}>• {d.title}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-ink-4 bg-ink-2 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-text-2">
                      Risks ({note.extractedRisks?.length ?? 0})
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-white">
                      {(note.extractedRisks ?? []).map((r, i) => (
                        <li key={i}>
                          • {r.title}
                          {r.severity ? ` [${r.severity}]` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AddMeetingNoteModal
        open={open}
        projectId={projectId}
        workstreams={workstreams}
        workbooks={workbooks}
        onClose={() => setOpen(false)}
        onSaved={(noteId, hasTranscript) => {
          void load();
          if (noteId && hasTranscript) {
            void extract(noteId);
          }
        }}
      />
    </section>
  );
}
