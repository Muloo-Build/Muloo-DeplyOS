"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

interface SectionOption {
  id: string;
  title: string;
}

export default function QuestionLibraryPicker(props: {
  projectId: string;
  workbookId: string;
  sections: SectionOption[];
  onImported: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [hubspotFilter, setHubspotFilter] = useState("");
  const [stakeholderFilter, setStakeholderFilter] = useState("");
  const [targetSectionId, setTargetSectionId] = useState(
    props.sections[0]?.id ?? ""
  );
  const [newSectionTitle, setNewSectionTitle] = useState("");

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
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    }
  }, [categoryFilter, hubspotFilter, stakeholderFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const hubspotAreas = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => {
      if (i.linkedHubSpotArea) set.add(i.linkedHubSpotArea);
    });
    return Array.from(set).sort();
  }, [items]);

  const stakeholders = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => {
      if (i.recommendedStakeholderType) set.add(i.recommendedStakeholderType);
    });
    return Array.from(set).sort();
  }, [items]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (selected.size === 0) {
      setError("Select at least one question");
      return;
    }
    const usingNewSection = !targetSectionId && newSectionTitle.trim();
    if (!targetSectionId && !usingNewSection) {
      setError("Pick a target section or enter a new section title");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        questionIds: Array.from(selected)
      };
      if (targetSectionId) {
        body.targetSectionId = targetSectionId;
      } else {
        body.newSection = { title: newSectionTitle.trim(), status: "draft" };
      }
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}/questions/import`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      props.onImported();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-surface space-y-4 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">
          Discovery question library
        </h4>
        <button
          type="button"
          onClick={props.onClose}
          className="text-xs text-text-secondary hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="brand-input rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="brand-input rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
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
          {hubspotAreas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={stakeholderFilter}
          onChange={(e) => setStakeholderFilter(e.target.value)}
          className="brand-input rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All stakeholders</option>
          {stakeholders.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="brand-surface-soft max-h-72 overflow-y-auto rounded-2xl border">
        {!items ? (
          <p className="p-3 text-sm text-text-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-3 text-sm text-text-secondary">
            No questions match. Seed the library or adjust filters.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 p-2 text-xs text-white"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{item.questionText}</p>
                  <p className="text-[11px] text-text-secondary">
                    {item.category}
                    {item.subcategory ? ` · ${item.subcategory}` : ""}
                    {` · ${item.answerType}`}
                    {item.recommendedStakeholderType
                      ? ` · ${item.recommendedStakeholderType}`
                      : ""}
                    {item.complexityLevel !== "standard"
                      ? ` · ${item.complexityLevel}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={targetSectionId}
          onChange={(e) => setTargetSectionId(e.target.value)}
          className="brand-input rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Create new section —</option>
          {props.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {!targetSectionId ? (
          <input
            type="text"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="New section title"
            className="brand-input rounded-lg border px-3 py-2 text-sm"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {selected.size} selected
        </p>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={importSelected}
          className="brand-primary rounded-full px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Importing…" : `Import ${selected.size} into workbook`}
        </button>
      </div>
    </div>
  );
}
