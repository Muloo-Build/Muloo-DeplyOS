"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ANSWER_TYPES,
  CANONICAL_CATEGORIES,
  COMPLEXITY_LEVELS,
  HUBSPOT_AREAS,
  STAKEHOLDER_TYPES,
  categorySuggestionFor,
  isCanonicalCategory
} from "./questionLibraryConstants";

interface LibraryItem {
  id: string;
  category: string;
  subcategory: string | null;
  questionText: string;
  helpText: string | null;
  answerType: string;
  options: string[];
  tags: string[];
  recommendedStakeholderType: string | null;
  defaultRequired: boolean;
  linkedHubSpotArea: string | null;
  linkedWebsiteArea: string | null;
  complexityLevel: string;
}

interface Draft {
  category: string;
  subcategory: string;
  questionText: string;
  helpText: string;
  answerType: string;
  optionsText: string;
  tagsText: string;
  recommendedStakeholderType: string;
  defaultRequired: boolean;
  linkedHubSpotArea: string;
  linkedWebsiteArea: string;
  complexityLevel: string;
}

const EMPTY_DRAFT: Draft = {
  category: CANONICAL_CATEGORIES[0],
  subcategory: "",
  questionText: "",
  helpText: "",
  answerType: "text",
  optionsText: "",
  tagsText: "",
  recommendedStakeholderType: "",
  defaultRequired: false,
  linkedHubSpotArea: "",
  linkedWebsiteArea: "",
  complexityLevel: "standard"
};

function toDraft(item: LibraryItem): Draft {
  return {
    category: item.category,
    subcategory: item.subcategory ?? "",
    questionText: item.questionText,
    helpText: item.helpText ?? "",
    answerType: item.answerType,
    optionsText: item.options.join("\n"),
    tagsText: item.tags.join(", "),
    recommendedStakeholderType: item.recommendedStakeholderType ?? "",
    defaultRequired: item.defaultRequired,
    linkedHubSpotArea: item.linkedHubSpotArea ?? "",
    linkedWebsiteArea: item.linkedWebsiteArea ?? "",
    complexityLevel: item.complexityLevel
  };
}

function toPayload(draft: Draft): Record<string, unknown> {
  return {
    category: draft.category.trim(),
    subcategory: draft.subcategory.trim() || null,
    questionText: draft.questionText.trim(),
    helpText: draft.helpText.trim() || null,
    answerType: draft.answerType,
    options:
      draft.answerType === "multiple_choice"
        ? draft.optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    tags: draft.tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    recommendedStakeholderType: draft.recommendedStakeholderType || null,
    defaultRequired: draft.defaultRequired,
    linkedHubSpotArea: draft.linkedHubSpotArea || null,
    linkedWebsiteArea: draft.linkedWebsiteArea || null,
    complexityLevel: draft.complexityLevel
  };
}

function answerTypeLabel(value: string): string {
  return ANSWER_TYPES.find((t) => t.value === value)?.label ?? value;
}

function stakeholderLabel(value: string | null): string | null {
  if (!value) return null;
  return STAKEHOLDER_TYPES.find((s) => s.value === value)?.label ?? value;
}

function hubspotLabel(value: string | null): string | null {
  if (!value) return null;
  return HUBSPOT_AREAS.find((a) => a.value === value)?.label ?? value;
}

export default function QuestionLibraryStudio() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [hubspotFilter, setHubspotFilter] = useState("");
  const [stakeholderFilter, setStakeholderFilter] = useState("");
  const [showNonCanonicalOnly, setShowNonCanonicalOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (hubspotFilter) params.set("linkedHubSpotArea", hubspotFilter);
      if (stakeholderFilter)
        params.set("recommendedStakeholderType", stakeholderFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `/api/discovery-question-library?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems((data.items ?? []) as LibraryItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    }
  }, [categoryFilter, hubspotFilter, stakeholderFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!items) return null;
    const nonCanonical = items.filter((i) => !isCanonicalCategory(i.category));
    return {
      total: items.length,
      nonCanonicalCount: nonCanonical.length,
      categoriesUsed: new Set(items.map((i) => i.category)).size
    };
  }, [items]);

  const visible = useMemo(() => {
    if (!items) return [];
    if (showNonCanonicalOnly) {
      return items.filter((i) => !isCanonicalCategory(i.category));
    }
    return items;
  }, [items, showNonCanonicalOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    visible.forEach((item) => {
      const key = item.category || "(uncategorised)";
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  async function saveCreate() {
    if (!createDraft.questionText.trim()) {
      setError("Question text is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery-question-library", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(createDraft))
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setCreating(false);
      setCreateDraft(EMPTY_DRAFT);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function saveUpdate(id: string) {
    if (!editDraft.questionText.trim()) {
      setError("Question text is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery-question-library/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editDraft))
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(id: string, label: string) {
    if (
      !window.confirm(
        `Delete this question?\n\n"${label}"\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery-question-library/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete");
      }
      if (editingId === id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {stats && stats.nonCanonicalCount > 0 ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-200">
                Categorisation health
              </h2>
              <p className="mt-1 text-sm text-amber-100/90">
                {stats.nonCanonicalCount} of {stats.total} questions use
                categories outside the canonical list. Tech stack, hosting,
                DNS, integrations, costs, access and security questions should
                live in their right category — not mixed into website/content
                discovery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNonCanonicalOnly((v) => !v)}
              className="rounded-full border border-amber-300/40 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
            >
              {showNonCanonicalOnly ? "Show all" : "Show only these"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text…"
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
            value={hubspotFilter}
            onChange={(e) => setHubspotFilter(e.target.value)}
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All HubSpot areas</option>
            {HUBSPOT_AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={stakeholderFilter}
            onChange={(e) => setStakeholderFilter(e.target.value)}
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All stakeholders</option>
            {STAKEHOLDER_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
          <span>
            {stats
              ? `${visible.length} shown · ${stats.total} total · ${stats.categoriesUsed} distinct categories`
              : "Loading…"}
          </span>
          {!creating ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setCreateDraft(EMPTY_DRAFT);
                setError(null);
              }}
              className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90"
            >
              New question
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
        <DraftForm
          title="New question"
          draft={createDraft}
          setDraft={setCreateDraft}
          busy={busy}
          onCancel={() => {
            setCreating(false);
            setError(null);
          }}
          onSave={() => void saveCreate()}
          saveLabel="Create question"
        />
      ) : null}

      {!items ? (
        <p className="text-sm text-text-secondary">Loading library…</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-sm text-text-secondary">
          No questions match. Try clearing filters or adding a new question.
        </p>
      ) : (
        grouped.map(([category, rows]) => (
          <section
            key={category}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/5 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  {category}
                </h3>
                {!isCanonicalCategory(category) ? (
                  <span
                    className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200"
                    title="This category is not in the canonical list. Edit each question to recategorise."
                  >
                    legacy
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-text-secondary">
                {rows.length} question{rows.length === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="divide-y divide-white/5">
              {rows.map((item) => (
                <li key={item.id} className="p-4">
                  {editingId === item.id ? (
                    <DraftForm
                      title="Edit question"
                      draft={editDraft}
                      setDraft={setEditDraft}
                      busy={busy}
                      onCancel={() => {
                        setEditingId(null);
                        setError(null);
                      }}
                      onSave={() => void saveUpdate(item.id)}
                      saveLabel="Save changes"
                      onDelete={() =>
                        void deleteItem(item.id, item.questionText)
                      }
                    />
                  ) : (
                    <ReadRow
                      item={item}
                      onEdit={() => {
                        setEditingId(item.id);
                        setEditDraft(toDraft(item));
                        setError(null);
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ReadRow(props: { item: LibraryItem; onEdit: () => void }) {
  const { item } = props;
  const stakeholder = stakeholderLabel(item.recommendedStakeholderType);
  const hubspot = hubspotLabel(item.linkedHubSpotArea);
  const suggestion = !isCanonicalCategory(item.category)
    ? categorySuggestionFor(`${item.category} ${item.questionText}`)
    : null;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{item.questionText}</p>
        {item.helpText ? (
          <p className="mt-1 text-xs text-text-secondary">{item.helpText}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
          <Tag>{answerTypeLabel(item.answerType)}</Tag>
          {item.subcategory ? <Tag>{item.subcategory}</Tag> : null}
          {stakeholder ? <Tag>{stakeholder}</Tag> : null}
          {hubspot ? <Tag>HubSpot · {hubspot}</Tag> : null}
          {item.linkedWebsiteArea ? (
            <Tag>Site · {item.linkedWebsiteArea}</Tag>
          ) : null}
          {item.defaultRequired ? <Tag>Required by default</Tag> : null}
          {item.complexityLevel !== "standard" ? (
            <Tag>{item.complexityLevel}</Tag>
          ) : null}
          {item.tags.map((t) => (
            <Tag key={t}>#{t}</Tag>
          ))}
        </div>
        {suggestion ? (
          <p className="mt-2 text-[11px] text-amber-200">
            Suggested category: <span className="font-medium">{suggestion}</span>{" "}
            — edit to recategorise.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={props.onEdit}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
      >
        Edit
      </button>
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

function DraftForm(props: {
  title: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  onDelete?: () => void;
}) {
  const { draft, setDraft } = props;
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CANONICAL_CATEGORIES);
    if (draft.category && !set.has(draft.category)) set.add(draft.category);
    return Array.from(set);
  }, [draft.category]);

  return (
    <div className="space-y-3 rounded-xl border border-brand-teal/30 bg-background-elevated p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{props.title}</h4>
        <div className="flex gap-2">
          {props.onDelete ? (
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.busy}
              className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.busy}
            className="text-xs text-text-secondary hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      <label className="block text-xs text-text-secondary">
        Question text *
        <textarea
          value={draft.questionText}
          onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
          rows={2}
          className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          placeholder="What do you want to ask the contributor?"
        />
      </label>

      <label className="block text-xs text-text-secondary">
        Helper text
        <input
          type="text"
          value={draft.helpText}
          onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
          className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          placeholder="Optional context shown under the question"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Category *
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
                {!isCanonicalCategory(c) ? " (legacy)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Subcategory
          <input
            type="text"
            value={draft.subcategory}
            onChange={(e) =>
              setDraft({ ...draft, subcategory: e.target.value })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
            placeholder="Optional subsection within the category"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Answer type
          <select
            value={draft.answerType}
            onChange={(e) =>
              setDraft({ ...draft, answerType: e.target.value })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            {ANSWER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Suggested contributor
          <select
            value={draft.recommendedStakeholderType}
            onChange={(e) =>
              setDraft({
                ...draft,
                recommendedStakeholderType: e.target.value
              })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            <option value="">No preference</option>
            {STAKEHOLDER_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.answerType === "multiple_choice" ? (
        <label className="block text-xs text-text-secondary">
          Options (one per line)
          <textarea
            value={draft.optionsText}
            onChange={(e) =>
              setDraft({ ...draft, optionsText: e.target.value })
            }
            rows={3}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Linked HubSpot area
          <select
            value={draft.linkedHubSpotArea}
            onChange={(e) =>
              setDraft({ ...draft, linkedHubSpotArea: e.target.value })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            <option value="">— None —</option>
            {HUBSPOT_AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Linked website area
          <input
            type="text"
            value={draft.linkedWebsiteArea}
            onChange={(e) =>
              setDraft({ ...draft, linkedWebsiteArea: e.target.value })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
            placeholder="e.g. landing pages, blog, forms"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-secondary">
          Complexity
          <select
            value={draft.complexityLevel}
            onChange={(e) =>
              setDraft({ ...draft, complexityLevel: e.target.value })
            }
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
          >
            {COMPLEXITY_LEVELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">
          Tags (comma-separated)
          <input
            type="text"
            value={draft.tagsText}
            onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
            className="brand-input mt-1 w-full rounded-lg border px-3 py-2 text-sm text-white"
            placeholder="e.g. onboarding, migration"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={draft.defaultRequired}
          onChange={(e) =>
            setDraft({ ...draft, defaultRequired: e.target.checked })
          }
        />
        Required by default when added to a workbook
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onSave}
          className="rounded-full bg-brand-teal px-4 py-2 text-xs font-semibold text-background-primary hover:opacity-90 disabled:opacity-50"
        >
          {props.busy ? "Saving…" : props.saveLabel}
        </button>
      </div>
    </div>
  );
}
