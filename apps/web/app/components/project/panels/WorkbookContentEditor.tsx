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
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
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

export interface EditorContributor {
  id: string;
  label: string;
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

// Slice 5 (new plan): badge styles for the review state surfaced
// next to each question. Mirrors the contributor view so operator
// + champion + contributor all see the same vocabulary.
const REVIEW_BADGE: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Approved",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  },
  needs_clarification: {
    label: "Needs clarification",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300"
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300"
  },
  answered: {
    label: "Answered",
    className: "border-white/10 bg-white/5 text-text-secondary"
  },
  unanswered: {
    label: "Unanswered",
    className: "border-white/10 bg-white/[0.02] text-text-secondary"
  },
  not_applicable: {
    label: "N/A",
    className: "border-white/10 bg-white/[0.02] text-text-secondary"
  }
};

function ContributorChips(props: {
  selected: string[];
  contributors: EditorContributor[];
  onChange: (next: string[]) => void;
  inheritedLabel?: string | null;
}) {
  // Slice 4 (new plan): compact multi-select for assignedContributorIds.
  // Click to toggle. Empty list (and an inherited assignment) shows a
  // muted "inherits from …" badge so operators understand why a
  // contributor can still see a question even when nothing is set
  // here directly.
  if (props.contributors.length === 0) {
    return (
      <p className="text-[10px] text-text-secondary">
        Add project contributors first to control assignment.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {props.contributors.map((contributor) => {
        const active = props.selected.includes(contributor.id);
        return (
          <button
            key={contributor.id}
            type="button"
            onClick={() => {
              if (active) {
                props.onChange(
                  props.selected.filter((id) => id !== contributor.id)
                );
              } else {
                props.onChange([...props.selected, contributor.id]);
              }
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              active
                ? "border-brand-teal/50 bg-brand-teal/10 text-brand-teal"
                : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
            }`}
          >
            {contributor.label}
          </button>
        );
      })}
      {props.selected.length === 0 && props.inheritedLabel ? (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] italic text-text-secondary">
          {props.inheritedLabel}
        </span>
      ) : null}
    </div>
  );
}

export default function WorkbookContentEditor(props: {
  projectId: string;
  workbookId: string;
  initialContent: WorkbookContent | null;
  contributors?: EditorContributor[];
  reviewerName?: string;
  onSaved: (next: WorkbookContent) => void;
  onClose: () => void;
}) {
  const contributors = props.contributors ?? [];
  const [content, setContent] = useState<WorkbookContent>(
    props.initialContent ?? { version: 1, sections: [] }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);
  const [openNotesKey, setOpenNotesKey] = useState<string | null>(null);
  const [pendingNotes, setPendingNotes] = useState<string>("");

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
        {
          id,
          title: "Untitled section",
          status: "draft",
          assignedContributorIds: [],
          questions: []
        }
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
                  status: "unanswered",
                  assignedContributorIds: []
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

  // Slice 5 (new plan): submit a review decision for a single
  // question. We POST to the dedicated review endpoint so the
  // server can stamp the timestamp authoritatively, then mirror the
  // result back into local state so the UI updates immediately
  // without a full reload.
  async function submitReview(
    sectionId: string,
    questionId: string,
    status: string,
    notes: string | null
  ) {
    const key = `${sectionId}::${questionId}`;
    setReviewBusyKey(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}/sections/${encodeURIComponent(sectionId)}/questions/${encodeURIComponent(questionId)}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            notes,
            reviewerName: props.reviewerName ?? null
          })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      const reviewed = data.question as WorkbookQuestion | undefined;
      if (reviewed) {
        // Mirror server-side review fields back into local state so
        // the editor reflects the new badge + reviewer stamp without
        // a round-trip refetch. We deliberately do NOT mark the
        // editor "dirty" — the server has already persisted this.
        // Patch ONLY the review fields so any unsaved local edits to
        // the question (e.g., the operator was mid-typing in the
        // response box) are not clobbered by stale DB values.
        setContent((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id !== sectionId
              ? s
              : {
                  ...s,
                  questions: s.questions.map((q) =>
                    q.id === questionId
                      ? {
                          ...q,
                          status: reviewed.status,
                          reviewerName: reviewed.reviewerName ?? null,
                          reviewedAt: reviewed.reviewedAt ?? null,
                          reviewNotes: reviewed.reviewNotes ?? null
                        }
                      : q
                  )
                }
          )
        }));
      }
      setOpenNotesKey(null);
      setPendingNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set review");
    } finally {
      setReviewBusyKey(null);
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

      {content.sections.map((section) => {
        const sectionAssigned = section.assignedContributorIds ?? [];
        return (
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

            {/* Slice 4 (new plan): section-level contributor assignment.
                Anyone selected here can see every question in the section
                via their /contributors/<token> link. */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/10 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                Section assigned to:
              </span>
              <ContributorChips
                selected={sectionAssigned}
                contributors={contributors}
                onChange={(next) =>
                  patchSection(section.id, { assignedContributorIds: next })
                }
                inheritedLabel="Inherits from workbook"
              />
            </div>

            {section.questions.length === 0 ? (
              <p className="text-xs text-text-secondary">
                No questions. Use the library picker or add manually.
              </p>
            ) : (
              <ul className="space-y-2">
                {section.questions.map((q) => {
                  const reviewKey = `${section.id}::${q.id}`;
                  const badge =
                    REVIEW_BADGE[q.status] ?? REVIEW_BADGE.unanswered;
                  const questionAssigned = q.assignedContributorIds ?? [];
                  const responseStr =
                    typeof q.response === "string" ? q.response : "";
                  const hasResponse = responseStr.trim().length > 0;
                  const notesOpen = openNotesKey === reviewKey;
                  const reviewBusy = reviewBusyKey === reviewKey;
                  return (
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

                      {/* Slice 4 (new plan): question-level assignment.
                          Overrides section + workbook assignment for this
                          single question. */}
                      <div className="flex flex-wrap items-center gap-2 px-1 pt-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                          Question assigned to:
                        </span>
                        <ContributorChips
                          selected={questionAssigned}
                          contributors={contributors}
                          onChange={(next) =>
                            patchQuestion(section.id, q.id, {
                              assignedContributorIds: next
                            })
                          }
                          inheritedLabel={
                            sectionAssigned.length > 0
                              ? "Inherits from section"
                              : "Inherits from workbook"
                          }
                        />
                      </div>

                      <textarea
                        value={responseStr}
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

                      {/* Slice 5 (new plan): per-answer review controls.
                          Hidden until a response exists — there's nothing
                          to review on an empty answer. */}
                      {hasResponse ? (
                        <div className="space-y-1.5 rounded-lg border border-white/5 bg-black/30 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {q.reviewedAt ? (
                              <span className="text-[10px] text-text-secondary">
                                {q.reviewerName
                                  ? `by ${q.reviewerName} `
                                  : ""}
                                on {q.reviewedAt.slice(0, 10)}
                              </span>
                            ) : null}
                            <div className="ml-auto flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={reviewBusy}
                                onClick={() =>
                                  void submitReview(
                                    section.id,
                                    q.id,
                                    "approved",
                                    null
                                  )
                                }
                                className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={reviewBusy}
                                onClick={() => {
                                  setOpenNotesKey(reviewKey);
                                  setPendingNotes(q.reviewNotes ?? "");
                                }}
                                className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                              >
                                Needs clarification
                              </button>
                              {q.status !== "unanswered" &&
                              q.status !== "answered" ? (
                                <button
                                  type="button"
                                  disabled={reviewBusy}
                                  onClick={() =>
                                    void submitReview(
                                      section.id,
                                      q.id,
                                      "answered",
                                      null
                                    )
                                  }
                                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-text-secondary hover:border-white/30 hover:text-white disabled:opacity-50"
                                >
                                  Reset
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {q.reviewNotes && !notesOpen ? (
                            <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-200">
                              {q.reviewNotes}
                            </p>
                          ) : null}
                          {notesOpen ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={pendingNotes}
                                onChange={(e) =>
                                  setPendingNotes(e.target.value)
                                }
                                placeholder="What needs clarifying? (visible to the contributor)"
                                rows={2}
                                className="brand-input w-full rounded-lg border px-2 py-1 text-xs"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={reviewBusy}
                                  onClick={() => {
                                    setOpenNotesKey(null);
                                    setPendingNotes("");
                                  }}
                                  className="text-[10px] text-text-secondary hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={reviewBusy}
                                  onClick={() =>
                                    void submitReview(
                                      section.id,
                                      q.id,
                                      "needs_clarification",
                                      pendingNotes.trim() || null
                                    )
                                  }
                                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                                >
                                  Send to contributor
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
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
        );
      })}
    </div>
  );
}
