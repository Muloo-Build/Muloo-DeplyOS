"use client";

import { useCallback, useEffect, useState } from "react";

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

const RESOURCE_LABEL: Record<string, string> = {
  internal_workbook: "Workbook",
  google_sheet: "Google Sheet",
  google_doc: "Google Doc",
  google_form: "Form",
  pdf: "PDF",
  miro_board: "Miro board",
  external_url: "Link"
};

const VISIBILITY_BADGE: Record<
  string,
  { label: string; className: string; tooltip: string }
> = {
  contributor_link: {
    label: "Shared with contributors",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    tooltip: "Filled in by named contributors via secure links."
  },
  client_champion: {
    label: "For champion review",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    tooltip: "Shared with the project champion for review or approval."
  },
  client_portal: {
    label: "Client portal",
    className: "border-brand-teal/40 bg-brand-teal/10 text-brand-teal",
    tooltip: "Visible to everyone on your client portal for this project."
  }
};

function workbookNeedsAttention(wb: Workbook): boolean {
  if (wb.status === "needs_review") return true;
  const sections = wb.workbookContent?.sections ?? [];
  for (const section of sections) {
    for (const q of section.questions ?? []) {
      if (q.status !== "answered" && q.status !== "approved") return true;
    }
  }
  return false;
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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

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
      const initialDrafts: Record<string, string> = {};
      (data.workbooks ?? []).forEach((wb: Workbook) => {
        (wb.workbookContent?.sections ?? []).forEach((section) => {
          (section.questions ?? []).forEach((q) => {
            const key = `${wb.id}::${section.id}::${q.id}`;
            initialDrafts[key] =
              typeof q.response === "string" ? q.response : "";
          });
        });
      });
      setDrafts(initialDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveQuestion(
    workbookId: string,
    sectionId: string,
    questionId: string
  ) {
    const key = `${workbookId}::${sectionId}::${questionId}`;
    setSavingId(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(
          projectId
        )}/workbooks/${encodeURIComponent(workbookId)}/responses`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responses: [
              {
                sectionId,
                questionId,
                response: drafts[key] ?? ""
              }
            ]
          })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setSavedAt((prev) => ({ ...prev, [key]: Date.now() }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
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
          Workbooks are how we collect structured input from your team during
          discovery, scoping and planning.
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
                setDrafts={setDrafts}
                savingId={savingId}
                savedAt={savedAt}
                onSave={saveQuestion}
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
                setDrafts={setDrafts}
                savingId={savingId}
                savedAt={savedAt}
                onSave={saveQuestion}
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
  setDrafts,
  savingId,
  savedAt,
  onSave,
  highlight
}: {
  wb: Workbook;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingId: string | null;
  savedAt: Record<string, number>;
  onSave: (
    workbookId: string,
    sectionId: string,
    questionId: string
  ) => Promise<void>;
  highlight?: boolean;
}) {
  const sections = wb.workbookContent?.sections ?? [];
  const total = sections.reduce(
    (acc, s) => acc + (s.questions?.length ?? 0),
    0
  );
  const answered = sections.reduce(
    (acc, s) =>
      acc +
      (s.questions ?? []).filter(
        (q) => q.status === "answered" || q.status === "approved"
      ).length,
    0
  );
  const badge = wb.visibility ? VISIBILITY_BADGE[wb.visibility] : null;
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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {wb.sourceLabel}
            </h3>
            {badge ? (
              <span
                title={badge.tooltip}
                className={`inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            {wb.resourceType
              ? RESOURCE_LABEL[wb.resourceType] ?? wb.resourceType
              : "Workbook"}
            {wb.status ? ` · ${wb.status}` : ""}
            {total > 0 ? ` · ${answered}/${total} answered` : ""}
          </p>
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

      {wb.resourceType !== "internal_workbook" ? (
        <p className="text-sm text-text-secondary">
          Open the linked resource above to contribute.
        </p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No questions have been added to this workbook yet.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.id}
              className="rounded-xl border border-white/5 bg-black/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  {section.title}
                </h4>
                <span className="text-[11px] text-text-secondary">
                  {section.status}
                </span>
              </div>
              <ul className="space-y-3">
                {(section.questions ?? []).map((q) => {
                  const key = `${wb.id}::${section.id}::${q.id}`;
                  return (
                    <li key={q.id} className="space-y-1">
                      <p className="text-xs text-white">
                        {q.questionText}
                        {q.required ? (
                          <span className="text-rose-400"> *</span>
                        ) : null}
                        {q.status === "answered" || q.status === "approved" ? (
                          <span className="ml-2 text-[10px] text-emerald-300">
                            ✓
                          </span>
                        ) : null}
                      </p>
                      {q.helpText ? (
                        <p className="text-[11px] text-text-secondary">
                          {q.helpText}
                        </p>
                      ) : null}
                      <textarea
                        value={drafts[key] ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: e.target.value
                          }))
                        }
                        rows={2}
                        placeholder={`Your answer (${q.answerType})`}
                        className="brand-input w-full rounded-lg border px-2 py-1 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingId === key}
                          onClick={() => onSave(wb.id, section.id, q.id)}
                          className="brand-primary rounded-full px-3 py-1 text-xs disabled:opacity-50"
                        >
                          {savingId === key ? "Saving…" : "Save"}
                        </button>
                        {savedAt[key] ? (
                          <span className="text-[10px] text-emerald-300">
                            Saved
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
