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
  workbookContent: { sections?: WorkbookSection[] } | null;
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

export default function ClientWorkbooksPanel({
  projectId
}: {
  projectId: string;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
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
      <p className="text-sm text-text-secondary">
        No workbooks have been shared with you yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {workbooks.map((wb) => {
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
        return (
          <div
            key={wb.id}
            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-5"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {wb.sourceLabel}
                </h3>
                <p className="text-xs text-text-secondary">
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
                              {q.status === "answered" ||
                              q.status === "approved" ? (
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
                                onClick={() =>
                                  saveQuestion(wb.id, section.id, q.id)
                                }
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
      })}
    </div>
  );
}
