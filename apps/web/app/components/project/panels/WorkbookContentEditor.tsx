"use client";

import { useState } from "react";

interface WorkbookQuestion {
  id: string;
  questionText: string;
  helpText?: string | null;
  answerType: string;
  required?: boolean;
  options?: string[];
  tags?: string[];
  assignedContributorIds?: string[];
  status: string;
  response?: unknown;
  responseFiles?: unknown[];
  responseLinks?: unknown[];
  internalNotes?: string | null;
  sourceLibraryItemId?: string | null;
}

interface WorkbookSection {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  linkedWorkstreamId?: string | null;
  assignedContributorIds?: string[];
  status: string;
  questions: WorkbookQuestion[];
}

export interface WorkbookContent {
  version: number;
  sections: WorkbookSection[];
}

const QUESTION_STATUSES = [
  "unanswered",
  "answered",
  "needs_clarification",
  "approved",
  "not_applicable"
];

const SECTION_STATUSES = [
  "draft",
  "shared",
  "in_progress",
  "submitted",
  "reviewed",
  "blocked"
];

export default function WorkbookContentEditor(props: {
  projectId: string;
  workbookId: string;
  initialContent: WorkbookContent | null;
  onSaved: (next: WorkbookContent) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState<WorkbookContent>(
    props.initialContent ?? { version: 1, sections: [] }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function update(next: WorkbookContent) {
    setContent(next);
    setDirty(true);
  }

  function addSection() {
    const id = `section_${Date.now().toString(36)}`;
    update({
      ...content,
      sections: [
        ...content.sections,
        { id, title: "Untitled section", status: "draft", questions: [] }
      ]
    });
  }

  function deleteSection(sectionId: string) {
    if (!confirm("Delete this section and its questions?")) return;
    update({
      ...content,
      sections: content.sections.filter((s) => s.id !== sectionId)
    });
  }

  function patchSection(sectionId: string, patch: Partial<WorkbookSection>) {
    update({
      ...content,
      sections: content.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      )
    });
  }

  function addQuestion(sectionId: string) {
    const id = `q_${Date.now().toString(36)}`;
    update({
      ...content,
      sections: content.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              questions: [
                ...s.questions,
                {
                  id,
                  questionText: "New question",
                  answerType: "long_text",
                  status: "unanswered"
                }
              ]
            }
          : s
      )
    });
  }

  function patchQuestion(
    sectionId: string,
    questionId: string,
    patch: Partial<WorkbookQuestion>
  ) {
    update({
      ...content,
      sections: content.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              questions: s.questions.map((q) =>
                q.id === questionId ? { ...q, ...patch } : q
              )
            }
      )
    });
  }

  function deleteQuestion(sectionId: string, questionId: string) {
    update({
      ...content,
      sections: content.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
      )
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workbookContent: content })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setDirty(false);
      props.onSaved(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {content.sections.length} section
          {content.sections.length === 1 ? "" : "s"} ·{" "}
          {content.sections.reduce((acc, s) => acc + s.questions.length, 0)}{" "}
          questions
          {dirty ? " · unsaved changes" : ""}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addSection}
            className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs text-white"
          >
            + Section
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={save}
            className="brand-primary rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="text-xs text-text-secondary hover:text-white"
          >
            Close
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {content.sections.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Empty workbook. Add a section, or import questions from the library.
        </p>
      ) : null}

      {content.sections.map((section) => (
        <div
          key={section.id}
          className="brand-surface-soft space-y-3 rounded-2xl border p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={section.title}
              onChange={(e) =>
                patchSection(section.id, { title: e.target.value })
              }
              className="brand-input flex-1 rounded-lg border px-2 py-1 text-sm font-semibold text-white"
            />
            <select
              value={section.status}
              onChange={(e) =>
                patchSection(section.id, { status: e.target.value })
              }
              className="brand-input rounded-lg border px-2 py-1 text-xs"
            >
              {SECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => deleteSection(section.id)}
              className="text-xs text-text-secondary hover:text-rose-400"
            >
              Delete section
            </button>
          </div>

          {section.questions.length === 0 ? (
            <p className="text-xs text-text-secondary">
              No questions. Use the library picker or add manually.
            </p>
          ) : (
            <ul className="space-y-2">
              {section.questions.map((q) => (
                <li
                  key={q.id}
                  className="space-y-1 rounded-xl border border-white/5 bg-black/20 p-2"
                >
                  <div className="flex items-start gap-2">
                    <textarea
                      value={q.questionText}
                      onChange={(e) =>
                        patchQuestion(section.id, q.id, {
                          questionText: e.target.value
                        })
                      }
                      rows={1}
                      className="brand-input flex-1 rounded-lg border px-2 py-1 text-xs"
                    />
                    <select
                      value={q.status}
                      onChange={(e) =>
                        patchQuestion(section.id, q.id, {
                          status: e.target.value
                        })
                      }
                      className="brand-input rounded-lg border px-2 py-1 text-[11px]"
                    >
                      {QUESTION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(section.id, q.id)}
                      className="text-[11px] text-text-secondary hover:text-rose-400"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={typeof q.response === "string" ? q.response : ""}
                    onChange={(e) =>
                      patchQuestion(section.id, q.id, {
                        response: e.target.value,
                        status:
                          e.target.value.trim().length > 0
                            ? q.status === "unanswered"
                              ? "answered"
                              : q.status
                            : "unanswered"
                      })
                    }
                    placeholder={`Response (${q.answerType})`}
                    rows={2}
                    className="brand-input w-full rounded-lg border px-2 py-1 text-xs"
                  />
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => addQuestion(section.id)}
            className="text-xs text-text-secondary hover:text-white"
          >
            + Add question manually
          </button>
        </div>
      ))}
    </div>
  );
}
