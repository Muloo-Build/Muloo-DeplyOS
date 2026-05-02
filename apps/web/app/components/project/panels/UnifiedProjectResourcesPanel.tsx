"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProjectResourcesPanel from "./ProjectResourcesPanel";
import ProjectWorkbookSharingSummary from "./ProjectWorkbookSharingSummary";

// Slice 6 (new plan): one panel that pulls together everything the
// project team or the client champion needs to see in a single tab —
// workbook sharing summary, every external resource (Miro/Docs/PDFs),
// and the latest synthesized discovery brief from slice 7. Replaces
// the side-by-side ProjectWorkbookSharingSummary + ProjectResourcesPanel
// pair so champions don't have to hunt across two cards to see the
// "everything attached to this project" view.

interface BriefRecord {
  id: string;
  sourceLabel: string;
  resourceType: string | null;
  content: string | null;
  createdAt: string;
}

const SECTION_TABS = [
  { id: "summary" as const, label: "Workbooks" },
  { id: "resources" as const, label: "Resources" },
  { id: "briefs" as const, label: "Discovery briefs" }
];

export default function UnifiedProjectResourcesPanel({
  projectId,
  onOpenDiscovery
}: {
  projectId: string;
  onOpenDiscovery: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "resources" | "briefs">(
    "summary"
  );
  const [briefs, setBriefs] = useState<BriefRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openBriefId, setOpenBriefId] = useState<string | null>(null);

  const loadBriefs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workbooks`, {
        credentials: "include"
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const all = (data.workbooks ?? []) as Array<Record<string, unknown>>;
      const matches: BriefRecord[] = all
        .filter((wb) => wb.resourceType === "discovery_brief")
        .map((wb) => ({
          id: String(wb.id ?? ""),
          sourceLabel: String(wb.sourceLabel ?? "Discovery brief"),
          resourceType:
            typeof wb.resourceType === "string" ? wb.resourceType : null,
          content: typeof wb.content === "string" ? wb.content : null,
          createdAt: String(wb.createdAt ?? "")
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setBriefs(matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load briefs");
    }
  }, [projectId]);

  useEffect(() => {
    void loadBriefs();
  }, [loadBriefs]);

  const briefBadge = useMemo(() => {
    if (!briefs || briefs.length === 0) return null;
    return briefs.length;
  }, [briefs]);

  return (
    <div className="space-y-3">
      <div className="brand-surface-soft rounded-2xl border border-white/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {SECTION_TABS.map((tab) => {
            const active = tab.id === activeTab;
            const count =
              tab.id === "briefs" ? briefBadge : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide transition ${
                  active
                    ? "border-brand-teal/50 bg-brand-teal/10 text-brand-teal"
                    : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
                }`}
              >
                {tab.label}
                {count !== null ? (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
          Everything attached to this project — workbook sharing status,
          external resources, and discovery briefs synthesized from
          approved answers.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {activeTab === "summary" ? (
        <ProjectWorkbookSharingSummary
          projectId={projectId}
          onOpenDiscovery={onOpenDiscovery}
        />
      ) : null}

      {activeTab === "resources" ? (
        <ProjectResourcesPanel projectId={projectId} />
      ) : null}

      {activeTab === "briefs" ? (
        <div className="space-y-2">
          {!briefs ? (
            <p className="text-sm text-text-secondary">Loading briefs…</p>
          ) : briefs.length === 0 ? (
            <div className="brand-surface rounded-2xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm font-medium text-white">
                No discovery briefs yet
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Approve some workbook answers, then click{" "}
                <strong className="text-white">Generate brief</strong> on
                the Discovery tab to synthesize a draft from the approved
                answers.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {briefs.map((brief) => {
                const open = openBriefId === brief.id;
                return (
                  <li
                    key={brief.id}
                    className="brand-surface-soft rounded-2xl border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {brief.sourceLabel}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          Created{" "}
                          {brief.createdAt
                            ? new Date(brief.createdAt).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenBriefId(open ? null : brief.id)
                        }
                        className="brand-surface rounded-full border border-white/10 px-3 py-1 text-[11px] text-text-secondary hover:border-white/30 hover:text-white"
                      >
                        {open ? "Hide" : "Read"}
                      </button>
                    </div>
                    {open && brief.content ? (
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-3 text-[11px] leading-relaxed text-text-primary">
                        {brief.content}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
