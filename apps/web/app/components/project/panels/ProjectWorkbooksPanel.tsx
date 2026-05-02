"use client";

import { useCallback, useEffect, useState } from "react";
import QuestionLibraryPicker from "./QuestionLibraryPicker";
import WorkbookContentEditor, {
  type WorkbookContent
} from "./WorkbookContentEditor";

interface Workbook {
  id: string;
  projectId: string;
  evidenceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  workbookContent: WorkbookContent | null;
  resourceType: string | null;
  assignedContributorIds: string[];
  ownerContributorId: string | null;
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

interface ContributorOption {
  id: string;
  label: string;
}

const RESOURCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "internal_workbook", label: "Internal workbook (structured)" },
  { value: "google_sheet", label: "Google Sheet" },
  { value: "google_doc", label: "Google Doc" },
  { value: "google_form", label: "Google Form" },
  { value: "pdf", label: "PDF" },
  { value: "miro_board", label: "Miro board" },
  { value: "external_url", label: "External URL" }
];

const RESOURCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const EVIDENCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "uploaded-doc", label: "Doc / Sheet / PDF" },
  { value: "website-link", label: "Link" },
  { value: "miro-note", label: "Miro" },
  { value: "operator-note", label: "Note" },
  { value: "client-input", label: "Form" }
];

const STATUS_OPTIONS = [
  "draft",
  "shared",
  "in_progress",
  "submitted",
  "reviewed",
  "needs_review",
  "approved"
];

export default function ProjectWorkbooksPanel(props: {
  projectId: string;
  workstreams: WorkstreamOption[];
  contributors?: ContributorOption[];
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [openWorkbookId, setOpenWorkbookId] = useState<string | null>(null);
  const [pickingForWorkbookId, setPickingForWorkbookId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState({
    sourceLabel: "",
    sourceUrl: "",
    resourceType: "internal_workbook",
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

  function evidenceTypeForResource(resourceType: string): string {
    switch (resourceType) {
      case "miro_board":
        return "miro-note";
      case "google_form":
        return "client-input";
      case "external_url":
        return "website-link";
      case "internal_workbook":
        return "operator-note";
      default:
        return "uploaded-doc";
    }
  }

  async function createWorkbook() {
    if (!draft.sourceLabel.trim()) {
      setError("Workbook name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const isInternal = draft.resourceType === "internal_workbook";
      const res = await fetch(`/api/projects/${props.projectId}/workbooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: draft.sourceLabel.trim(),
          sourceUrl: draft.sourceUrl.trim() || null,
          evidenceType: evidenceTypeForResource(draft.resourceType),
          resourceType: draft.resourceType,
          workstreamId: draft.workstreamId || null,
          status: draft.status,
          ownerName: draft.ownerName.trim() || null,
          content: draft.content.trim() || null,
          workbookContent: isInternal ? { version: 1, sections: [] } : null,
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
        resourceType: "internal_workbook",
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
      if (openWorkbookId === id) setOpenWorkbookId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Internal workbooks, Google Sheets/Docs, Miro boards and PDFs shared
          with stakeholders.
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
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={draft.resourceType}
              onChange={(e) =>
                setDraft({ ...draft, resourceType: e.target.value })
              }
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            >
              {RESOURCE_TYPE_OPTIONS.map((opt) => (
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
          {draft.resourceType !== "internal_workbook" ? (
            <input
              type="url"
              value={draft.sourceUrl}
              onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://..."
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
            />
          ) : null}
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
            const isInternal = wb.resourceType === "internal_workbook";
            const isOpen = openWorkbookId === wb.id;
            const sectionsCount = wb.workbookContent?.sections?.length ?? 0;
            const questionsCount =
              wb.workbookContent?.sections?.reduce(
                (acc, s) => acc + (s.questions?.length ?? 0),
                0
              ) ?? 0;
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
                      {wb.resourceType
                        ? RESOURCE_TYPE_LABEL[wb.resourceType] ?? wb.resourceType
                        : EVIDENCE_TYPE_OPTIONS.find(
                            (o) => o.value === wb.evidenceType
                          )?.label ?? wb.evidenceType}
                      {wb.status ? ` · ${wb.status}` : ""}
                      {wb.ownerName ? ` · owner ${wb.ownerName}` : ""}
                      {workstream ? ` · ${workstream.name}` : ""}
                      {isInternal
                        ? ` · ${sectionsCount} sections · ${questionsCount} questions`
                        : ""}
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
                  <div className="flex items-center gap-2">
                    {isInternal ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenWorkbookId(isOpen ? null : wb.id)
                          }
                          className="text-xs text-brand-teal hover:underline"
                        >
                          {isOpen ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPickingForWorkbookId(
                              pickingForWorkbookId === wb.id ? null : wb.id
                            )
                          }
                          className="text-xs text-brand-teal hover:underline"
                        >
                          {pickingForWorkbookId === wb.id
                            ? "Close library"
                            : "+ From library"}
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteWorkbook(wb.id)}
                      className="text-xs text-text-secondary hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {isInternal && pickingForWorkbookId === wb.id ? (
                  <div className="mt-3">
                    <QuestionLibraryPicker
                      projectId={props.projectId}
                      workbookId={wb.id}
                      sections={(wb.workbookContent?.sections ?? []).map(
                        (s) => ({ id: s.id, title: s.title })
                      )}
                      onImported={() => {
                        void load();
                      }}
                      onClose={() => setPickingForWorkbookId(null)}
                    />
                  </div>
                ) : null}

                {isInternal && isOpen ? (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <WorkbookContentEditor
                      projectId={props.projectId}
                      workbookId={wb.id}
                      initialContent={wb.workbookContent}
                      onSaved={() => {
                        void load();
                      }}
                      onClose={() => setOpenWorkbookId(null)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
