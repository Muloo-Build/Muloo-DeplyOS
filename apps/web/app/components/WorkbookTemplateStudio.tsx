"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ANSWER_TYPES,
  CANONICAL_CATEGORIES,
  STAKEHOLDER_TYPES
} from "./questionLibraryConstants";

interface TemplateQuestion {
  id: string;
  sectionId: string;
  libraryQuestionId: string | null;
  questionText: string;
  helpText: string | null;
  answerType: string;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
}

interface TemplateSection {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  questions: TemplateQuestion[];
}

interface TemplateSummary {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  suggestedProjectType: string | null;
  suggestedContributorRole: string | null;
  defaultVisibility: string;
  tags: string[];
  isArchived: boolean;
  sectionCount: number;
  questionCount: number;
  updatedAt: string;
}

interface TemplateDetail extends TemplateSummary {
  sections: TemplateSection[];
}

interface LibraryQuestion {
  id: string;
  category: string;
  questionText: string;
  helpText: string | null;
  answerType: string;
  options: string[];
  recommendedStakeholderType: string | null;
}

const VISIBILITY_OPTIONS = [
  { value: "internal", label: "Internal only" },
  { value: "client_facing", label: "Client-facing" }
];

const SUGGESTED_PROJECT_TYPES = [
  "Onboarding",
  "Audit",
  "Migration",
  "Optimisation",
  "Implementation",
  "Discovery"
];

function answerTypeLabel(value: string) {
  return ANSWER_TYPES.find((t) => t.value === value)?.label ?? value;
}

function visibilityLabel(value: string) {
  return VISIBILITY_OPTIONS.find((v) => v.value === value)?.label ?? value;
}

function stakeholderLabel(value: string | null) {
  if (!value) return null;
  return STAKEHOLDER_TYPES.find((s) => s.value === value)?.label ?? value;
}

export default function WorkbookTemplateStudio() {
  const [mode, setMode] = useState<
    { kind: "list" } | { kind: "detail"; templateId: string }
  >({ kind: "list" });

  if (mode.kind === "detail") {
    return (
      <TemplateDetailView
        templateId={mode.templateId}
        onBack={() => setMode({ kind: "list" })}
      />
    );
  }
  return (
    <TemplateListView
      onOpen={(id) => setMode({ kind: "detail", templateId: id })}
    />
  );
}

function TemplateListView(props: { onOpen: (templateId: string) => void }) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftProjectType, setDraftProjectType] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      if (projectTypeFilter)
        params.set("suggestedProjectType", projectTypeFilter);
      if (!showArchived) params.set("isArchived", "false");
      const res = await fetch(
        `/api/workbook-templates?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load templates");
      }
      setTemplates((data.templates ?? []) as TemplateSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [search, categoryFilter, projectTypeFilter, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    if (!draftTitle.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workbook-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          category: draftCategory || null,
          suggestedProjectType: draftProjectType || null
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to create");
      }
      setCreating(false);
      setDraftTitle("");
      setDraftCategory("");
      setDraftProjectType("");
      props.onOpen(data.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CANONICAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={projectTypeFilter}
            onChange={(e) => setProjectTypeFilter(e.target.value)}
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All project types</option>
            {SUGGESTED_PROJECT_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Include archived
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
          <span>
            {templates ? `${templates.length} templates` : "Loading…"}
          </span>
          {!creating ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setError(null);
              }}
              className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90"
            >
              New template
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {creating ? (
        <section className="space-y-3 rounded-2xl border border-brand-teal/30 bg-background-elevated p-5">
          <h3 className="text-sm font-semibold text-white">New template</h3>
          <label className="block text-xs text-text-secondary">
            Title *
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="e.g. HubSpot Marketing Hub Onboarding"
              className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-text-secondary">
              Category
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
              >
                <option value="">— Choose later —</option>
                {CANONICAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-text-secondary">
              Suggested project type
              <select
                value={draftProjectType}
                onChange={(e) => setDraftProjectType(e.target.value)}
                className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
              >
                <option value="">— Any —</option>
                {SUGGESTED_PROJECT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              disabled={busy}
              className="text-xs text-text-secondary hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createTemplate()}
              disabled={busy}
              className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create and open"}
            </button>
          </div>
        </section>
      ) : null}

      {!templates ? (
        <p className="text-sm text-text-secondary">Loading templates…</p>
      ) : templates.length === 0 ? (
        <p className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-sm text-text-secondary">
          No templates yet. Click "New template" to create your first reusable
          workbook template — projects will pull copies from these.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => props.onOpen(t.id)}
                className="block w-full rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5 text-left transition hover:border-brand-teal/40 hover:bg-background-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    {t.title}
                  </h3>
                  {t.isArchived ? (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200">
                      archived
                    </span>
                  ) : null}
                </div>
                {t.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
                    {t.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
                  {t.category ? <Tag>{t.category}</Tag> : null}
                  {t.suggestedProjectType ? (
                    <Tag>{t.suggestedProjectType}</Tag>
                  ) : null}
                  {stakeholderLabel(t.suggestedContributorRole) ? (
                    <Tag>{stakeholderLabel(t.suggestedContributorRole)}</Tag>
                  ) : null}
                  <Tag>{visibilityLabel(t.defaultVisibility)}</Tag>
                </div>
                <p className="mt-3 text-[11px] text-text-muted">
                  {t.sectionCount} section{t.sectionCount === 1 ? "" : "s"} ·{" "}
                  {t.questionCount} question
                  {t.questionCount === 1 ? "" : "s"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateDetailView(props: {
  templateId: string;
  onBack: () => void;
}) {
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load");
      }
      setTemplate(data.template as TemplateDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [props.templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchTemplate(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to save");
      }
      setTemplate(data.template as TemplateDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateTemplate() {
    const newTitle = window.prompt(
      "New title for the duplicated template:",
      template ? `${template.title} (copy)` : ""
    );
    if (newTitle === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}/duplicate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim() || undefined })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to duplicate");
      }
      window.alert(`Duplicated as "${data.template.title}". Opening list.`);
      props.onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate() {
    if (!template) return;
    if (
      !window.confirm(
        `Delete template "${template.title}"?\n\nProject workbooks already created from it will keep working but will lose the template link. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to delete");
      }
      if (
        typeof data.detachedProjectWorkbooks === "number" &&
        data.detachedProjectWorkbooks > 0
      ) {
        window.alert(
          `Template deleted. ${data.detachedProjectWorkbooks} project workbook(s) lost the template link but were preserved.`
        );
      }
      props.onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function addSection() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}/sections`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New section" })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to add section");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setBusy(false);
    }
  }

  async function moveSection(index: number, direction: -1 | 1) {
    if (!template) return;
    const next = index + direction;
    if (next < 0 || next >= template.sections.length) return;
    const orderedIds = template.sections.map((s) => s.id);
    const tmp = orderedIds[index];
    orderedIds[index] = orderedIds[next];
    orderedIds[next] = tmp;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/${props.templateId}/sections`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to reorder");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={props.onBack}
          className="text-xs text-text-secondary hover:text-white"
        >
          ← Back to templates
        </button>
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : (
          <p className="text-sm text-text-secondary">Loading template…</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={props.onBack}
          className="text-xs text-text-secondary hover:text-white"
        >
          ← Back to templates
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void patchTemplate({ isArchived: !template.isArchived })
            }
            disabled={busy}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5 disabled:opacity-50"
          >
            {template.isArchived ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => void duplicateTemplate()}
            disabled={busy}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5 disabled:opacity-50"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => void deleteTemplate()}
            disabled={busy}
            className="rounded-full border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <TemplateMetadataEditor
        template={template}
        busy={busy}
        onSave={(patch) => void patchTemplate(patch)}
      />

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">
              Sections & questions
            </h3>
            <p className="mt-1 text-xs text-text-secondary">
              {template.sections.length} section
              {template.sections.length === 1 ? "" : "s"} ·{" "}
              {template.questionCount} question
              {template.questionCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void addSection()}
            disabled={busy}
            className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
          >
            Add section
          </button>
        </div>

        {template.sections.length === 0 ? (
          <p className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-elevated p-4 text-sm text-text-secondary">
            No sections yet. Add one to start grouping questions.
          </p>
        ) : (
          <ul className="space-y-4">
            {template.sections.map((section, index) => (
              <li key={section.id}>
                <SectionEditor
                  section={section}
                  isFirst={index === 0}
                  isLast={index === template.sections.length - 1}
                  onMoveUp={() => void moveSection(index, -1)}
                  onMoveDown={() => void moveSection(index, 1)}
                  onChanged={() => void load()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TemplateMetadataEditor(props: {
  template: TemplateDetail;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(props.template.title);
  const [description, setDescription] = useState(props.template.description ?? "");
  const [category, setCategory] = useState(props.template.category ?? "");
  const [projectType, setProjectType] = useState(
    props.template.suggestedProjectType ?? ""
  );
  const [contributorRole, setContributorRole] = useState(
    props.template.suggestedContributorRole ?? ""
  );
  const [visibility, setVisibility] = useState(
    props.template.defaultVisibility
  );
  const [tagsText, setTagsText] = useState(props.template.tags.join(", "));

  useEffect(() => {
    setTitle(props.template.title);
    setDescription(props.template.description ?? "");
    setCategory(props.template.category ?? "");
    setProjectType(props.template.suggestedProjectType ?? "");
    setContributorRole(props.template.suggestedContributorRole ?? "");
    setVisibility(props.template.defaultVisibility);
    setTagsText(props.template.tags.join(", "));
  }, [props.template]);

  if (!editing) {
    return (
      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {props.template.title}
            </h2>
            {props.template.description ? (
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                {props.template.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
              {props.template.category ? (
                <Tag>{props.template.category}</Tag>
              ) : null}
              {props.template.suggestedProjectType ? (
                <Tag>{props.template.suggestedProjectType}</Tag>
              ) : null}
              {stakeholderLabel(props.template.suggestedContributorRole) ? (
                <Tag>
                  {stakeholderLabel(props.template.suggestedContributorRole)}
                </Tag>
              ) : null}
              <Tag>{visibilityLabel(props.template.defaultVisibility)}</Tag>
              {props.template.tags.map((t) => (
                <Tag key={t}>#{t}</Tag>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
          >
            Edit details
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-brand-teal/30 bg-background-elevated p-5">
      <h3 className="text-sm font-semibold text-white">Edit template details</h3>
      <label className="block text-xs text-text-secondary">
        Title *
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block text-xs text-text-secondary">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          placeholder="What is this template for? When should an operator use it?"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            <option value="">— None —</option>
            {CANONICAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Suggested project type
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            <option value="">— Any —</option>
            {SUGGESTED_PROJECT_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Suggested contributor role
          <select
            value={contributorRole}
            onChange={(e) => setContributorRole(e.target.value)}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            <option value="">— None —</option>
            {STAKEHOLDER_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Default visibility when added to a project
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            {VISIBILITY_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-text-secondary">
        Tags (comma-separated)
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          placeholder="e.g. onboarding, b2b, regulated"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={props.busy}
          className="text-xs text-text-secondary hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            const tags = tagsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            props.onSave({
              title: title.trim(),
              description: description.trim() || null,
              category: category || null,
              suggestedProjectType: projectType || null,
              suggestedContributorRole: contributorRole || null,
              defaultVisibility: visibility,
              tags
            });
            setEditing(false);
          }}
          disabled={props.busy || !title.trim()}
          className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
        >
          {props.busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </section>
  );
}

function SectionEditor(props: {
  section: TemplateSection;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const { section } = props;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setTitle(section.title);
    setDescription(section.description ?? "");
  }, [section]);

  async function saveSection() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/sections/${section.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null
          })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }
      setEditing(false);
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection() {
    if (
      !window.confirm(
        `Delete section "${section.title}" and its ${section.questions.length} question(s)?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workbook-templates/sections/${section.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete");
      }
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= section.questions.length) return;
    const orderedIds = section.questions.map((q) => q.id);
    const tmp = orderedIds[index];
    orderedIds[index] = orderedIds[next];
    orderedIds[next] = tmp;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workbook-templates/sections/${section.id}/questions`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to reorder");
      }
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-elevated">
      <header className="flex items-start justify-between gap-3 border-b border-white/5 p-4">
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
              placeholder="Section title"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
              placeholder="Optional description shown above the questions"
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white">
              {section.title}
            </h4>
            {section.description ? (
              <p className="mt-1 text-xs text-text-secondary">
                {section.description}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-text-muted">
              {section.questions.length} question
              {section.questions.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {!editing ? (
            <>
              <IconButton
                title="Move up"
                disabled={props.isFirst || busy}
                onClick={props.onMoveUp}
              >
                ↑
              </IconButton>
              <IconButton
                title="Move down"
                disabled={props.isLast || busy}
                onClick={props.onMoveDown}
              >
                ↓
              </IconButton>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/5"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void deleteSection()}
                disabled={busy}
                className="rounded-full border border-rose-400/30 px-3 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
                className="text-[11px] text-text-secondary hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSection()}
                disabled={busy || !title.trim()}
                className="rounded-full bg-brand-teal px-3 py-1 text-[11px] font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </>
          )}
        </div>
      </header>

      {error ? (
        <p className="border-b border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-white/5">
        {section.questions.map((question, index) => (
          <li key={question.id} className="px-4 py-3">
            <QuestionRow
              question={question}
              isFirst={index === 0}
              isLast={index === section.questions.length - 1}
              onMoveUp={() => void moveQuestion(index, -1)}
              onMoveDown={() => void moveQuestion(index, 1)}
              onChanged={props.onChanged}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-white/5 p-3">
        {adding ? (
          <AddQuestionForm
            sectionId={section.id}
            onCreated={() => {
              setAdding(false);
              props.onChanged();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-brand-teal hover:underline"
          >
            + Add question
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionRow(props: {
  question: TemplateQuestion;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const { question } = props;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.questionText);
  const [help, setHelp] = useState(question.helpText ?? "");
  const [answerType, setAnswerType] = useState(question.answerType);
  const [optionsText, setOptionsText] = useState(question.options.join("\n"));
  const [required, setRequired] = useState(question.isRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(question.questionText);
    setHelp(question.helpText ?? "");
    setAnswerType(question.answerType);
    setOptionsText(question.options.join("\n"));
    setRequired(question.isRequired);
  }, [question]);

  async function saveQuestion() {
    if (!text.trim()) {
      setError("Question text is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/questions/${question.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: text.trim(),
            helpText: help.trim() || null,
            answerType,
            options:
              answerType === "multiple_choice"
                ? optionsText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            isRequired: required
          })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }
      setEditing(false);
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion() {
    if (!window.confirm(`Delete question?\n\n"${question.questionText}"`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workbook-templates/questions/${question.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete");
      }
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
        />
        <input
          type="text"
          value={help}
          onChange={(e) => setHelp(e.target.value)}
          placeholder="Helper text (optional)"
          className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={answerType}
            onChange={(e) => setAnswerType(e.target.value)}
            className="brand-input rounded-lg border px-3 py-2 text-sm text-white"
          >
            {ANSWER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>
        </div>
        {answerType === "multiple_choice" ? (
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={3}
            placeholder="Options (one per line)"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
          />
        ) : null}
        {error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="text-[11px] text-text-secondary hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void saveQuestion()}
            disabled={busy || !text.trim()}
            className="rounded-full bg-brand-teal px-3 py-1 text-[11px] font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{question.questionText}</p>
        {question.helpText ? (
          <p className="mt-1 text-xs text-text-secondary">
            {question.helpText}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
          <Tag>{answerTypeLabel(question.answerType)}</Tag>
          {question.libraryQuestionId ? (
            <Tag>Linked to library</Tag>
          ) : (
            <Tag>Custom</Tag>
          )}
          {question.isRequired ? <Tag>Required</Tag> : null}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-300">{error}</p>
        ) : null}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <IconButton
          title="Move up"
          disabled={props.isFirst || busy}
          onClick={props.onMoveUp}
        >
          ↑
        </IconButton>
        <IconButton
          title="Move down"
          disabled={props.isLast || busy}
          onClick={props.onMoveDown}
        >
          ↓
        </IconButton>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/5"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => void deleteQuestion()}
          disabled={busy}
          className="rounded-full border border-rose-400/30 px-3 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AddQuestionForm(props: {
  sectionId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryResults, setLibraryResults] = useState<LibraryQuestion[] | null>(
    null
  );

  const [customText, setCustomText] = useState("");
  const [customHelp, setCustomHelp] = useState("");
  const [customAnswerType, setCustomAnswerType] = useState("text");
  const [customOptions, setCustomOptions] = useState("");
  const [customRequired, setCustomRequired] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (librarySearch.trim()) params.set("search", librarySearch.trim());
      const res = await fetch(
        `/api/discovery-question-library?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load");
      }
      setLibraryResults((data.items ?? []).slice(0, 30) as LibraryQuestion[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [librarySearch]);

  useEffect(() => {
    if (tab === "library") {
      const handle = setTimeout(() => void loadLibrary(), 250);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [tab, loadLibrary]);

  async function addFromLibrary(item: LibraryQuestion) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/sections/${props.sectionId}/questions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryQuestionId: item.id })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add");
      }
      props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    if (!customText.trim()) {
      setError("Question text is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workbook-templates/sections/${props.sectionId}/questions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: customText.trim(),
            helpText: customHelp.trim() || null,
            answerType: customAnswerType,
            options:
              customAnswerType === "multiple_choice"
                ? customOptions
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            isRequired: customRequired
          })
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add");
      }
      props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-teal/30 bg-background-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <TabButton active={tab === "library"} onClick={() => setTab("library")}>
            From library
          </TabButton>
          <TabButton active={tab === "custom"} onClick={() => setTab("custom")}>
            Custom question
          </TabButton>
        </div>
        <button
          type="button"
          onClick={props.onCancel}
          disabled={busy}
          className="text-[11px] text-text-secondary hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {tab === "library" ? (
        <>
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search question library…"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5">
            {!libraryResults ? (
              <p className="p-3 text-xs text-text-secondary">Loading…</p>
            ) : libraryResults.length === 0 ? (
              <p className="p-3 text-xs text-text-secondary">
                No matching library questions. Create one in the Question
                Library page first, or add a custom question.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {libraryResults.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-start gap-2 p-2 text-xs text-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p>{q.questionText}</p>
                      <p className="mt-0.5 text-[10px] text-text-secondary">
                        {q.category} · {answerTypeLabel(q.answerType)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void addFromLibrary(q)}
                      disabled={busy}
                      className="rounded-full bg-brand-teal px-3 py-1 text-[10px] font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={2}
            placeholder="Question text *"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            value={customHelp}
            onChange={(e) => setCustomHelp(e.target.value)}
            placeholder="Helper text (optional)"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={customAnswerType}
              onChange={(e) => setCustomAnswerType(e.target.value)}
              className="brand-input rounded-lg border px-3 py-2 text-sm text-white"
            >
              {ANSWER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={customRequired}
                onChange={(e) => setCustomRequired(e.target.checked)}
              />
              Required
            </label>
          </div>
          {customAnswerType === "multiple_choice" ? (
            <textarea
              value={customOptions}
              onChange={(e) => setCustomOptions(e.target.value)}
              rows={3}
              placeholder="Options (one per line)"
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm text-white"
            />
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void addCustom()}
              disabled={busy || !customText.trim()}
              className="rounded-full bg-brand-teal px-3 py-1 text-[11px] font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add custom question"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag(props: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-background-elevated px-2 py-0.5">
      {props.children}
    </span>
  );
}

function IconButton(props: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-xs text-white hover:bg-white/5 disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full px-3 py-1 text-[11px] ${
        props.active
          ? "bg-brand-teal text-background-primary"
          : "border border-white/10 text-text-secondary hover:text-white"
      }`}
    >
      {props.children}
    </button>
  );
}
