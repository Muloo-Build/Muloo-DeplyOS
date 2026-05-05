"use client";

import { useCallback, useEffect, useState } from "react";

interface Resource {
  id: string;
  sourceLabel: string;
  sourceUrl: string | null;
  resourceType: string | null;
  visibility: string | null;
  ownerName: string | null;
  content: string | null;
  createdAt: string;
}

const RESOURCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "miro_board", label: "Miro board" },
  { value: "google_doc", label: "Google Doc" },
  { value: "google_sheet", label: "Google Sheet" },
  { value: "google_form", label: "Google Form" },
  { value: "pdf", label: "PDF" },
  { value: "external_url", label: "Other link" }
];

const RESOURCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const VISIBILITY_OPTIONS: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "internal",
    label: "Internal only",
    description: "Muloo team only — not shared with the client portal."
  },
  {
    value: "contributor_link",
    label: "Contributor access",
    description: "Visible to assigned contributors via secure link."
  },
  {
    value: "client_champion",
    label: "Champion review",
    description: "Visible to the project champion in the client portal."
  },
  {
    value: "client_portal",
    label: "Client portal",
    description: "Visible to all client portal users."
  }
];

const VISIBILITY_BADGE: Record<string, { label: string; className: string; tooltip: string }> = {
  internal: {
    label: "Internal only",
    className: "border-ink-4 bg-white/5 text-text-2",
    tooltip: "Muloo team only. Not shared with the client portal."
  },
  contributor_link: {
    label: "Contributor access",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    tooltip: "Visible to assigned contributors via secure link."
  },
  client_champion: {
    label: "Champion review",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    tooltip: "Visible to the project champion in the client portal."
  },
  client_portal: {
    label: "Client portal",
    className: "border-brand-teal/40 bg-brand-teal/10 text-brand-teal",
    tooltip: "Visible to all client portal users on this project."
  }
};

function evidenceTypeForResource(resourceType: string): string {
  switch (resourceType) {
    case "miro_board":
      return "miro-note";
    case "google_form":
      return "client-input";
    case "external_url":
      return "website-link";
    default:
      return "uploaded-doc";
  }
}

export default function ProjectResourcesPanel({
  projectId
}: {
  projectId: string;
}) {
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(
    null
  );
  const [draft, setDraft] = useState({
    sourceLabel: "",
    sourceUrl: "",
    resourceType: "miro_board",
    visibility: "internal",
    ownerName: "",
    content: ""
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workbooks`, {
        credentials: "include"
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const all = (data.workbooks ?? []) as Resource[];
        setResources(all.filter((wb) => wb.resourceType !== "internal_workbook"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createResource() {
    if (!draft.sourceLabel.trim()) {
      setError("Resource title is required");
      return;
    }
    // Server requires either a sourceUrl OR content for non-workbook
    // evidence rows. Enforce sourceUrl client-side so users always have a
    // working link to share — that's the whole point of a "resource" entry.
    if (!draft.sourceUrl.trim() && !draft.content.trim()) {
      setError("Add a link (URL) or some notes for this resource");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/workbooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: draft.sourceLabel.trim(),
          sourceUrl: draft.sourceUrl.trim() || null,
          evidenceType: evidenceTypeForResource(draft.resourceType),
          resourceType: draft.resourceType,
          visibility: draft.visibility,
          ownerName: draft.ownerName.trim() || null,
          content: draft.content.trim() || null,
          workbookContent: null,
          sessionNumber: 0
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setDraft({
        sourceLabel: "",
        sourceUrl: "",
        resourceType: "miro_board",
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

  async function updateVisibility(id: string, visibility: string) {
    setSavingVisibilityId(id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/workbooks/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingVisibilityId(null);
    }
  }

  async function deleteResource(id: string) {
    if (!confirm("Remove this resource?")) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/workbooks/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide text-white"
        >
          {showForm ? "Cancel" : "Add resource"}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {showForm ? (
        <div className="brand-surface-soft space-y-3 rounded-[14px] border p-4">
          <input
            type="text"
            value={draft.sourceLabel}
            onChange={(e) =>
              setDraft({ ...draft, sourceLabel: e.target.value })
            }
            placeholder="Resource title (e.g. Project workspace board)"
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
            <input
              type="text"
              value={draft.ownerName}
              onChange={(e) =>
                setDraft({ ...draft, ownerName: e.target.value })
              }
              placeholder="Owner (optional)"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <input
            type="url"
            value={draft.sourceUrl}
            onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
            placeholder="https://… (link to the resource — required unless you add notes below)"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div>
            <p className="mb-1 text-xs font-medium text-text-2">
              Visibility — who can see this resource?
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
                    name="resource-visibility"
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
            onClick={createResource}
            className="brand-primary rounded-full px-4 py-2 text-sm"
          >
            {busy ? "Saving…" : "Save resource"}
          </button>
        </div>
      ) : null}

      {!resources ? (
        <p className="text-sm text-text-2">Loading…</p>
      ) : resources.length === 0 ? (
        <div className="brand-surface rounded-[14px] border border-dashed border-ink-4 p-6 text-center">
          <p className="text-sm font-medium text-white">No resources yet</p>
          <p className="mt-1 text-xs text-text-2">
            Add Miro boards, Google Docs, PDFs and other links here. Set
            visibility to control who can see each one.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => {
            const badge =
              VISIBILITY_BADGE[r.visibility ?? "internal"] ??
              VISIBILITY_BADGE.internal;
            return (
              <li
                key={r.id}
                className="brand-surface-soft rounded-[14px] border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {r.sourceLabel}
                      </p>
                      <span
                        title={badge.tooltip}
                        className={`inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-2">
                      {r.resourceType
                        ? RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType
                        : "Link"}
                      {r.ownerName ? ` · owner: ${r.ownerName}` : ""}
                    </p>
                    {r.content ? (
                      <p className="mt-1 text-xs text-text-2">
                        {r.content}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.sourceUrl ? (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-brand-teal hover:underline"
                      >
                        Open ↗
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteResource(r.id)}
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
                      disabled={savingVisibilityId === r.id}
                      onClick={() => updateVisibility(r.id, opt.value)}
                      title={opt.description}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition disabled:opacity-50 ${
                        (r.visibility ?? "internal") === opt.value
                          ? "border-brand-teal/50 bg-brand-teal/10 text-brand-teal"
                          : "border-ink-4 text-text-2 hover:border-ink-5 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
