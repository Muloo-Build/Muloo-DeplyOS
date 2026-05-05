"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionLibraryPicker from "./QuestionLibraryPicker";
import WorkbookPublicSharePanel from "./WorkbookPublicSharePanel";
import WorkbookContentEditor, {
  type WorkbookContent,
  type EditorContributor
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
  visibility: string | null;
  ownerName: string | null;
  sharedWith: string[];
  dueDate: string | null;
  linkedSectionIds: string[];
  sourceTemplateId: string | null;
  publicShareToken: string | null;
  publicShareEnabled: boolean;
  publicShareExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplateChoice {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  suggestedProjectType: string | null;
  defaultVisibility: string;
  sectionCount: number;
  questionCount: number;
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

const VISIBILITY_OPTIONS: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "internal",
    label: "Internal only",
    description: "Only the Muloo team can see this. Nothing appears in the client portal."
  },
  {
    value: "contributor_link",
    label: "Contributor access",
    description: "Assigned contributors can fill it in via a secure link. They do not need a portal account."
  },
  {
    value: "client_champion",
    label: "Client champion review",
    description: "The project champion sees it in their portal so they can review or approve."
  },
  {
    value: "client_portal",
    label: "Client portal visible",
    description: "Everyone on the client portal for this project can see it."
  }
];

const VISIBILITY_BADGE: Record<
  string,
  { label: string; className: string; tooltip: string }
> = {
  internal: {
    label: "Internal only",
    className: "border-ink-4 bg-white/5 text-text-2",
    tooltip: "Muloo team only. Not shared with the client portal."
  },
  contributor_link: {
    label: "Contributor access",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    tooltip: "Assigned contributors can fill it in via a secure link."
  },
  client_champion: {
    label: "Champion review",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    tooltip: "The project champion sees it in their portal."
  },
  client_portal: {
    label: "Client portal",
    className: "border-brand-teal/40 bg-brand-teal/10 text-brand-teal",
    tooltip: "Visible to all client portal users on this project."
  }
};

export default function ProjectWorkbooksPanel(props: {
  projectId: string;
  workstreams: WorkstreamOption[];
  contributors?: ContributorOption[];
  reviewerName?: string;
}) {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [openWorkbookId, setOpenWorkbookId] = useState<string | null>(null);
  const [pickingForWorkbookId, setPickingForWorkbookId] = useState<
    string | null
  >(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [fetchedContributors, setFetchedContributors] = useState<
    ContributorOption[] | null
  >(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const router = useRouter();
  // Same 401 → /login pattern used elsewhere in the operator UI:
  // surface session expiry as an actionable redirect instead of a
  // misleading "Failed to load workbooks" banner.
  const handleSessionExpiry = useCallback(
    (res: Response): boolean => {
      if (res.status === 401) {
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );
  const [draft, setDraft] = useState({
    sourceLabel: "",
    sourceUrl: "",
    resourceType: "internal_workbook",
    evidenceType: "uploaded-doc",
    workstreamId: "",
    status: "draft",
    visibility: "internal",
    ownerName: "",
    content: ""
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${props.projectId}/workbooks`, {
        credentials: "include"
      });
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setWorkbooks(data.workbooks ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workbooks");
    }
  }, [props.projectId, handleSessionExpiry]);

  useEffect(() => {
    void load();
  }, [load]);

  // Slice 4 (new plan): pull the project's contributors so the
  // workbook editor can offer a real multi-select for section /
  // question assignment. Falls back to the prop if the parent
  // already provided them, so we don't double-fetch.
  useEffect(() => {
    if (props.contributors && props.contributors.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${props.projectId}/contributors`,
          { credentials: "include" }
        );
        if (handleSessionExpiry(res)) return;
        const data = await res.json();
        if (cancelled || data.error) return;
        const list = Array.isArray(data.contributors)
          ? (data.contributors as Array<Record<string, unknown>>).map(
              (c) => {
                const contact = (c.contact ?? {}) as Record<string, unknown>;
                const first =
                  typeof contact.firstName === "string"
                    ? contact.firstName
                    : "";
                const last =
                  typeof contact.lastName === "string"
                    ? contact.lastName
                    : "";
                const role = typeof c.role === "string" ? c.role : "";
                const id = typeof c.id === "string" ? c.id : "";
                const name = `${first} ${last}`.trim();
                return {
                  id,
                  label: name
                    ? role
                      ? `${name} · ${role}`
                      : name
                    : role || id
                };
              }
            )
          : [];
        setFetchedContributors(list);
      } catch {
        setFetchedContributors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.projectId, props.contributors]);

  const editorContributors: EditorContributor[] = useMemo(() => {
    const source = props.contributors ?? fetchedContributors ?? [];
    return source.map((c) => ({ id: c.id, label: c.label }));
  }, [props.contributors, fetchedContributors]);

  // Slice 7 (new plan): generate a brief from approved answers
  // across every workbook on the project and persist it as a new
  // resource (resourceType = "discovery_brief"). The unified
  // resources panel surfaces it for the team to read / share.
  async function generateBrief() {
    setBriefBusy(true);
    setBriefMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/discovery-brief/synthesize`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveAsResource: true })
        }
      );
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      const count = Number(data.approvedCount ?? 0);
      setBriefMessage(
        count === 0
          ? "Brief saved as a draft, but no approved answers were found yet — approve some workbook responses first."
          : `Brief saved with ${count} approved answer${count === 1 ? "" : "s"}. Check Resources to read it.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to synthesize brief");
    } finally {
      setBriefBusy(false);
    }
  }

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
      const createRes = await fetch(`/api/projects/${props.projectId}/workbooks`, {
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
          visibility: draft.visibility,
          ownerName: draft.ownerName.trim() || null,
          content: draft.content.trim() || null,
          workbookContent: isInternal ? { version: 1, sections: [] } : null,
          sessionNumber: 0
        })
      });
      if (handleSessionExpiry(createRes)) return;
      const data = await createRes.json();
      if (!createRes.ok || data.error) {
        throw new Error(data.error ?? "Failed to create workbook");
      }
      setDraft({
        sourceLabel: "",
        sourceUrl: "",
        resourceType: "internal_workbook",
        evidenceType: "uploaded-doc",
        workstreamId: "",
        status: "draft",
        visibility: "internal",
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

  async function updateVisibility(workbookId: string, visibility: string) {
    setSavingVisibilityId(workbookId);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${workbookId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility })
        }
      );
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setSavingVisibilityId(null);
    }
  }

  async function deleteWorkbook(id: string) {
    if (!confirm("Delete this workbook?")) return;
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (handleSessionExpiry(res)) return;
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
      <div className="brand-surface-soft rounded-[14px] border border-ink-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              Workbooks — discovery & contribution tools
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-2">
              Workbooks collect structured input from contributors who often do
              not have client portal access. They are{" "}
              <strong className="text-white">internal by default</strong> — use
              the visibility control on each workbook to share it with
              contributors, the project champion, or the full client portal.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-2">
              <strong className="text-white">Recommended:</strong> start from a
              reusable template managed in{" "}
              <a
                href="/workbooks"
                className="font-medium text-brand-teal hover:underline"
              >
                Operations → Workbooks
              </a>
              . Use “Add blank” only for one-off project workbooks that are not
              worth promoting into a template.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTemplatePicker((value) => !value);
                if (!showTemplatePicker) setShowForm(false);
              }}
              className="brand-primary rounded-full px-3 py-1.5 text-xs uppercase tracking-wide"
            >
              {showTemplatePicker ? "Cancel" : "+ From template"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm((value) => !value);
                if (!showForm) setShowTemplatePicker(false);
              }}
              className="brand-surface rounded-full border border-ink-4 px-3 py-1.5 text-xs uppercase tracking-wide text-text-2 hover:border-ink-5 hover:text-white"
            >
              {showForm ? "Cancel" : "Add blank"}
            </button>
            {/* Slice 7 (new plan): one-click brief synthesis. */}
            <button
              type="button"
              disabled={briefBusy}
              onClick={() => void generateBrief()}
              className="brand-surface rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {briefBusy ? "Generating…" : "✓ Generate brief"}
            </button>
          </div>
        </div>
        {briefMessage ? (
          <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-200">
            {briefMessage}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {showTemplatePicker ? (
        <FromTemplatePicker
          projectId={props.projectId}
          workstreams={props.workstreams}
          onCreated={() => {
            setShowTemplatePicker(false);
            void load();
          }}
          onError={setError}
          onSessionExpired={handleSessionExpiry}
        />
      ) : null}

      {showForm ? (
        <div className="brand-surface-soft space-y-3 rounded-[14px] border p-4">
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
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-2">
              Visibility — who can see this workbook?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition ${
                    draft.visibility === opt.value
                      ? "border-brand-teal/50 bg-brand-teal/10"
                      : "border-ink-4 hover:border-ink-5"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={draft.visibility === opt.value}
                    onChange={() => setDraft({ ...draft, visibility: opt.value })}
                    className="mt-0.5 shrink-0 accent-brand-teal"
                  />
                  <span>
                    <span className="block font-semibold text-white">
                      {opt.label}
                    </span>
                    <span className="text-text-2">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
        <p className="text-sm text-text-2">Loading…</p>
      ) : workbooks.length === 0 ? (
        <div className="brand-surface rounded-[14px] border border-dashed border-ink-4 p-6 text-center">
          <p className="text-sm font-medium text-white">No workbooks yet</p>
          <p className="mt-1 text-xs text-text-2">
            Create a workbook to collect discovery input. New workbooks default
            to <strong className="text-white">Internal only</strong> — nothing
            is shown to clients until you deliberately share it.
          </p>
        </div>
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
            const answeredCount =
              wb.workbookContent?.sections?.reduce(
                (acc, s) =>
                  acc +
                  (s.questions ?? []).filter(
                    (q) =>
                      q.status === "answered" || q.status === "approved"
                  ).length,
                0
              ) ?? 0;
            const visKey = (wb.visibility ?? "internal") as keyof typeof VISIBILITY_BADGE;
            const badge = VISIBILITY_BADGE[visKey] ?? VISIBILITY_BADGE.internal;
            return (
              <li
                key={wb.id}
                className="brand-surface-soft rounded-[14px] border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {wb.sourceLabel}
                      </p>
                      <span
                        title={badge.tooltip}
                        className={`inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {wb.status ? (
                        <span className="rounded-full border border-ink-4 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-2">
                          {wb.status}
                        </span>
                      ) : null}
                      {wb.sourceTemplateId ? (
                        <span
                          title="Created from a workbook template. Edits here do not affect the template."
                          className="cursor-help rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-brand-teal"
                        >
                          From template
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-text-2">
                      {wb.resourceType
                        ? RESOURCE_TYPE_LABEL[wb.resourceType] ?? wb.resourceType
                        : EVIDENCE_TYPE_OPTIONS.find(
                            (o) => o.value === wb.evidenceType
                          )?.label ?? wb.evidenceType}
                      {wb.ownerName ? ` · owner: ${wb.ownerName}` : ""}
                      {workstream ? ` · ${workstream.name}` : ""}
                      {isInternal && questionsCount > 0
                        ? ` · ${answeredCount}/${questionsCount} answered`
                        : isInternal
                          ? ` · ${sectionsCount} sections`
                          : ""}
                    </p>
                    {wb.content ? (
                      <p className="mt-1 text-xs text-text-2">
                        {wb.content}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                      className="text-xs text-text-2 hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-text-2">
                    Visibility:
                  </span>
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={savingVisibilityId === wb.id}
                      onClick={() => updateVisibility(wb.id, opt.value)}
                      title={opt.description}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition disabled:opacity-50 ${
                        (wb.visibility ?? "internal") === opt.value
                          ? "border-brand-teal/50 bg-brand-teal/10 text-brand-teal"
                          : "border-ink-4 text-text-2 hover:border-ink-5 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
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

                {isInternal ? (
                  <WorkbookPublicSharePanel
                    projectId={props.projectId}
                    workbookId={wb.id}
                    publicShareToken={wb.publicShareToken}
                    publicShareEnabled={wb.publicShareEnabled}
                    publicShareExpiresAt={wb.publicShareExpiresAt}
                    onUpdated={() => {
                      void load();
                    }}
                    onSessionExpired={handleSessionExpiry}
                  />
                ) : null}

                {isInternal && isOpen ? (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <WorkbookContentEditor
                      projectId={props.projectId}
                      workbookId={wb.id}
                      initialContent={wb.workbookContent}
                      contributors={editorContributors}
                      reviewerName={props.reviewerName}
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

function FromTemplatePicker(props: {
  projectId: string;
  workstreams: WorkstreamOption[];
  onCreated: () => void;
  onError: (message: string | null) => void;
  // Threaded from the parent so a 401 inside the picker uses the same
  // /login redirect as the rest of the panel rather than surfacing a
  // misleading "Failed to load templates" banner.
  onSessionExpired: (res: Response) => boolean;
}) {
  const [templates, setTemplates] = useState<TemplateChoice[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    sourceLabel: "",
    visibility: "internal",
    workstreamId: "",
    ownerName: ""
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("isArchived", "false");
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `/api/workbook-templates?${params.toString()}`,
        { credentials: "include" }
      );
      if (props.onSessionExpired(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load templates");
      }
      setTemplates((data.templates ?? []) as TemplateChoice[]);
    } catch (err) {
      props.onError(
        err instanceof Error ? err.message : "Failed to load templates"
      );
    }
  }, [search, props]);

  useEffect(() => {
    const handle = setTimeout(() => void load(), 200);
    return () => clearTimeout(handle);
  }, [load]);

  const selected = useMemo(
    () => templates?.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  function pickTemplate(t: TemplateChoice) {
    setSelectedId(t.id);
    setDraft({
      sourceLabel: t.title,
      visibility:
        t.defaultVisibility === "client_facing" ? "client_portal" : "internal",
      workstreamId: "",
      ownerName: ""
    });
  }

  async function createFromTemplate() {
    if (!selected) return;
    if (!draft.sourceLabel.trim()) {
      props.onError("Workbook name is required");
      return;
    }
    setBusy(true);
    props.onError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/from-template`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selected.id,
            sourceLabel: draft.sourceLabel.trim(),
            visibility: draft.visibility,
            workstreamId: draft.workstreamId || null,
            ownerName: draft.ownerName.trim() || null,
            sessionNumber: 0
          })
        }
      );
      if (props.onSessionExpired(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to create workbook");
      }
      props.onCreated();
    } catch (err) {
      props.onError(
        err instanceof Error ? err.message : "Failed to create workbook"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-surface-soft space-y-3 rounded-[14px] border border-brand-teal/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Add workbook from template
          </p>
          <p className="mt-0.5 text-xs text-text-2">
            Pick a template — a copy will be added to this project. Editing
            the project copy does not change the template, and changes to the
            template later do not retroactively change this copy.
          </p>
        </div>
      </div>

      {selected ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {selected.title}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                disabled={busy}
                className="text-xs text-text-2 hover:text-white disabled:opacity-50"
              >
                Pick a different template
              </button>
            </div>
            {selected.description ? (
              <p className="mt-1 text-xs text-text-2">
                {selected.description}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-text-3">
              {selected.sectionCount} section
              {selected.sectionCount === 1 ? "" : "s"} ·{" "}
              {selected.questionCount} question
              {selected.questionCount === 1 ? "" : "s"}
            </p>
          </div>

          <input
            type="text"
            value={draft.sourceLabel}
            onChange={(e) =>
              setDraft({ ...draft, sourceLabel: e.target.value })
            }
            placeholder="Workbook name in this project"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div>
            <p className="mb-1 text-xs font-medium text-text-2">
              Visibility — who can see this workbook?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition ${
                    draft.visibility === opt.value
                      ? "border-brand-teal/50 bg-brand-teal/10"
                      : "border-ink-4 hover:border-ink-5"
                  }`}
                >
                  <input
                    type="radio"
                    name="from-template-visibility"
                    value={opt.value}
                    checked={draft.visibility === opt.value}
                    onChange={() =>
                      setDraft({ ...draft, visibility: opt.value })
                    }
                    className="mt-0.5 shrink-0 accent-brand-teal"
                  />
                  <span>
                    <span className="block font-semibold text-white">
                      {opt.label}
                    </span>
                    <span className="text-text-2">
                      {opt.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !draft.sourceLabel.trim()}
            onClick={createFromTemplate}
            className="brand-primary rounded-full px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Creating…" : "Add workbook to project"}
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          {!templates ? (
            <p className="text-xs text-text-2">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-4 p-4 text-xs text-text-2">
              No active templates yet. Build one in the{" "}
              <a
                href="/workbooks"
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-teal hover:underline"
              >
                Workbooks
              </a>{" "}
              section under Operations.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pickTemplate(t)}
                    className="block w-full rounded-xl border border-ink-4 bg-ink-2 p-3 text-left transition hover:border-brand-teal/40"
                  >
                    <p className="text-sm font-semibold text-white">
                      {t.title}
                    </p>
                    {t.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-text-2">
                        {t.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-2">
                      {t.category ? (
                        <span className="rounded-full border border-ink-4 bg-white/5 px-2 py-0.5">
                          {t.category}
                        </span>
                      ) : null}
                      {t.suggestedProjectType ? (
                        <span className="rounded-full border border-ink-4 bg-white/5 px-2 py-0.5">
                          {t.suggestedProjectType}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-ink-4 bg-white/5 px-2 py-0.5">
                        {t.sectionCount}s · {t.questionCount}q
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
