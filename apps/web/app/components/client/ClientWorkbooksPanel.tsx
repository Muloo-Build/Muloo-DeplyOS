"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface WorkbookQuestion {
  id: string;
  questionText: string;
  helpText?: string | null;
  answerType: string;
  status: string;
  response?: unknown;
  required?: boolean;
}

interface WorkbookSection {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  questions: WorkbookQuestion[];
}

interface Workbook {
  id: string;
  sourceLabel: string;
  sourceUrl: string | null;
  resourceType: string | null;
  status: string | null;
  visibility: string | null;
  workbookContent: { sections?: WorkbookSection[] } | null;
}

interface ViewerInfo {
  isChampion: boolean;
  isContributor: boolean;
  skeleton: boolean;
}

function questionAnswered(q: WorkbookQuestion): boolean {
  return q.status === "answered" || q.status === "approved";
}

function workbookNeedsAttention(wb: Workbook): boolean {
  if (wb.status === "needs_review") return true;
  const sections = wb.workbookContent?.sections ?? [];
  for (const section of sections) {
    for (const q of section.questions ?? []) {
      if (!questionAnswered(q)) return true;
    }
  }
  return false;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ClientWorkbooksPanel({
  projectId
}: {
  projectId: string;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [viewer, setViewer] = useState<ViewerInfo>({
    isChampion: false,
    isContributor: false,
    skeleton: false
  });
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirtyByWorkbook, setDirtyByWorkbook] = useState<
    Record<string, Set<string>>
  >({});
  const [savingWorkbookId, setSavingWorkbookId] = useState<string | null>(null);
  const [savedAtByWorkbook, setSavedAtByWorkbook] = useState<
    Record<string, number>
  >({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/workbooks`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setWorkbooks(data.workbooks ?? []);
      if (data.viewer) setViewer(data.viewer);
      setDrafts((prev) => {
        const next: Record<string, string> = {};
        (data.workbooks ?? []).forEach((wb: Workbook) => {
          (wb.workbookContent?.sections ?? []).forEach((section) => {
            (section.questions ?? []).forEach((q) => {
              const key = `${wb.id}::${section.id}::${q.id}`;
              const fromServer =
                typeof q.response === "string" ? q.response : "";
              next[key] = key in prev ? prev[key] : fromServer;
            });
          });
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(
    workbookId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) {
    const key = `${workbookId}::${sectionId}::${questionId}`;
    setDrafts((prev) => ({ ...prev, [key]: value }));
    setDirtyByWorkbook((prev) => {
      const existing = prev[workbookId] ?? new Set<string>();
      if (existing.has(key)) return prev;
      const nextSet = new Set(existing);
      nextSet.add(key);
      return { ...prev, [workbookId]: nextSet };
    });
  }

  async function saveWorkbook(wb: Workbook) {
    const dirtyKeys = dirtyByWorkbook[wb.id];
    if (!dirtyKeys || dirtyKeys.size === 0) return;
    setSavingWorkbookId(wb.id);
    setError(null);
    try {
      const responses: Array<{
        sectionId: string;
        questionId: string;
        response: string;
      }> = [];
      (wb.workbookContent?.sections ?? []).forEach((section) => {
        (section.questions ?? []).forEach((q) => {
          const key = `${wb.id}::${section.id}::${q.id}`;
          if (dirtyKeys.has(key)) {
            responses.push({
              sectionId: section.id,
              questionId: q.id,
              response: drafts[key] ?? ""
            });
          }
        });
      });
      if (responses.length === 0) return;
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(
          projectId
        )}/workbooks/${encodeURIComponent(wb.id)}/responses`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setDirtyByWorkbook((prev) => {
        const next = { ...prev };
        delete next[wb.id];
        return next;
      });
      setSavedAtByWorkbook((prev) => ({ ...prev, [wb.id]: Date.now() }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingWorkbookId(null);
    }
  }

  if (!workbooks) {
    return <p className="text-sm text-text-secondary">Loading workbooks…</p>;
  }

  if (workbooks.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-6 text-center">
        <p className="text-sm font-semibold text-white">
          No workbooks shared with you yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
          Workbooks are shared when we need input, review, or approval from
          your team.
          {viewer.isChampion
            ? " As project champion, you'll see anything that needs your review here."
            : ""}
        </p>
      </div>
    );
  }

  const needsReview = viewer.isChampion
    ? workbooks.filter(workbookNeedsAttention)
    : [];
  const everythingElse = viewer.isChampion
    ? workbooks.filter((wb) => !workbookNeedsAttention(wb))
    : workbooks;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card/60 p-4">
        <p className="text-xs leading-relaxed text-text-secondary">
          Fill in your answers below. Your changes stay on this page until you
          click <strong className="text-white">Save changes</strong> at the top
          of each workbook — nothing is sent until you save.
          {viewer.isChampion
            ? " You're the project champion, so anything needing your review or approval is grouped at the top."
            : viewer.isContributor
              ? " You're seeing only the workbooks you've been assigned to."
              : ""}
        </p>
      </div>

      {viewer.isChampion && needsReview.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-white">
              Needs your review
            </h3>
            <span className="text-[11px] text-text-secondary">
              {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-3">
            {needsReview.map((wb) => (
              <WorkbookCard
                key={wb.id}
                wb={wb}
                drafts={drafts}
                dirtyKeys={dirtyByWorkbook[wb.id]}
                savingWorkbookId={savingWorkbookId}
                savedAt={savedAtByWorkbook[wb.id] ?? null}
                onUpdateDraft={updateDraft}
                onSaveWorkbook={saveWorkbook}
                highlight
              />
            ))}
          </div>
        </section>
      ) : null}

      {everythingElse.length > 0 ? (
        <section className="space-y-3">
          {viewer.isChampion && needsReview.length > 0 ? (
            <h3 className="text-sm font-semibold text-text-secondary">
              All workbooks
            </h3>
          ) : null}
          <div className="space-y-3">
            {everythingElse.map((wb) => (
              <WorkbookCard
                key={wb.id}
                wb={wb}
                drafts={drafts}
                dirtyKeys={dirtyByWorkbook[wb.id]}
                savingWorkbookId={savingWorkbookId}
                savedAt={savedAtByWorkbook[wb.id] ?? null}
                onUpdateDraft={updateDraft}
                onSaveWorkbook={saveWorkbook}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WorkbookCard({
  wb,
  drafts,
  dirtyKeys,
  savingWorkbookId,
  savedAt,
  onUpdateDraft,
  onSaveWorkbook,
  highlight
}: {
  wb: Workbook;
  drafts: Record<string, string>;
  dirtyKeys: Set<string> | undefined;
  savingWorkbookId: string | null;
  savedAt: number | null;
  onUpdateDraft: (
    workbookId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) => void;
  onSaveWorkbook: (wb: Workbook) => Promise<void>;
  highlight?: boolean;
}) {
  const sections = wb.workbookContent?.sections ?? [];
  const total = sections.reduce(
    (acc, s) => acc + (s.questions?.length ?? 0),
    0
  );
  const answered = sections.reduce(
    (acc, s) => acc + (s.questions ?? []).filter(questionAnswered).length,
    0
  );
  const isExternal =
    wb.resourceType !== null && wb.resourceType !== "internal_workbook";
  const dirtyCount = dirtyKeys?.size ?? 0;
  const isSaving = savingWorkbookId === wb.id;
  const savedRecently =
    savedAt && Date.now() - savedAt < 8000 ? formatRelativeTime(savedAt) : null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-[rgba(255,255,255,0.08)] bg-background-card"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">
            {wb.sourceLabel}
          </h3>
          {total > 0 ? (
            <p className="mt-0.5 text-xs text-text-secondary">
              {answered}/{total} question{total === 1 ? "" : "s"} answered
            </p>
          ) : null}
        </div>
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
      </div>

      {isExternal ? (
        <p className="text-sm text-text-secondary">
          Open the linked resource above to contribute.
        </p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No questions have been added to this workbook yet.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
            <button
              type="button"
              disabled={isSaving || dirtyCount === 0}
              onClick={() => void onSaveWorkbook(wb)}
              className="brand-primary rounded-full px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving
                ? "Saving…"
                : dirtyCount > 0
                  ? `Save changes (${dirtyCount})`
                  : "Save changes"}
            </button>
            {dirtyCount > 0 && !isSaving ? (
              <span className="text-[11px] text-amber-300">
                {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
              </span>
            ) : savedRecently ? (
              <span className="text-[11px] text-emerald-300">
                ✓ Saved {savedRecently}
              </span>
            ) : (
              <span className="text-[11px] text-text-secondary">
                Type your answers — nothing is sent until you save.
              </span>
            )}
          </div>

          <div className="space-y-4">
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                workbookId={wb.id}
                section={section}
                drafts={drafts}
                dirtyKeys={dirtyKeys}
                onUpdateDraft={onUpdateDraft}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionBlock({
  workbookId,
  section,
  drafts,
  dirtyKeys,
  onUpdateDraft
}: {
  workbookId: string;
  section: WorkbookSection;
  drafts: Record<string, string>;
  dirtyKeys: Set<string> | undefined;
  onUpdateDraft: (
    workbookId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) => void;
}) {
  const questions = section.questions ?? [];
  const answeredCount = useMemo(
    () => questions.filter(questionAnswered).length,
    [questions]
  );
  const totalCount = questions.length;
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-white">{section.title}</h4>
        {totalCount > 0 ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              answeredCount === totalCount
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-text-secondary"
            }`}
          >
            {answeredCount}/{totalCount} answered
          </span>
        ) : null}
      </div>
      {section.description ? (
        <p className="mb-2 text-[11px] leading-relaxed text-text-secondary">
          {section.description}
        </p>
      ) : null}
      {totalCount === 0 ? (
        <p className="text-[11px] text-text-secondary">
          No questions in this section.
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => {
            const key = `${workbookId}::${section.id}::${q.id}`;
            const isDirty = dirtyKeys?.has(key) ?? false;
            const answered = questionAnswered(q);
            return (
              <li key={q.id} className="space-y-1">
                <p className="text-xs text-white">
                  {q.questionText}
                  {q.required ? <span className="text-rose-400"> *</span> : null}
                  {answered && !isDirty ? (
                    <span className="ml-2 text-[10px] text-emerald-300">✓</span>
                  ) : null}
                  {isDirty ? (
                    <span className="ml-2 text-[10px] text-amber-300">
                      • unsaved
                    </span>
                  ) : null}
                </p>
                {q.helpText ? (
                  <p className="text-[11px] text-text-secondary">{q.helpText}</p>
                ) : null}
                <textarea
                  value={drafts[key] ?? ""}
                  onChange={(e) =>
                    onUpdateDraft(workbookId, section.id, q.id, e.target.value)
                  }
                  rows={2}
                  placeholder="Type your answer here"
                  className="brand-input w-full rounded-lg border px-2 py-1 text-xs"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
