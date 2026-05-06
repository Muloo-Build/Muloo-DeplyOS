"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Upload,
  UserPlus
} from "lucide-react";

import AppShell from "./AppShell";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { Stat, StatsGrid } from "./ui/Stat";

interface ProjectSummary {
  id: string;
  name: string;
  client?: { id: string; name: string };
  selectedHubs?: string[];
}

interface WorkbookRecord {
  id: string;
  sessionNumber: number;
  evidenceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  resourceType?: string | null;
  status?: string | null;
  ownerName?: string | null;
  publicShareToken?: string | null;
  publicShareEnabled?: boolean;
  publicShareExpiresAt?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  workbookContent?: unknown;
}

interface DiscoverySection {
  sessionNumber: number;
  title?: string;
  fields?: Array<{ id: string; label: string; value?: unknown }>;
  status?: string;
}

interface DiscoverySummary {
  sections?: DiscoverySection[];
  totalQuestions?: number;
  answeredQuestions?: number;
}

const resourceIcon: Record<string, React.ReactNode> = {
  google_sheet: <FileSpreadsheet size={13} className="text-status-ok" />,
  google_doc: <FileText size={13} className="text-status-info" />,
  google_form: <FileText size={13} className="text-status-info" />,
  pdf: <FileText size={13} className="text-status-warn" />,
  miro_board: <Layers size={13} className="text-[#FFC766]" />,
  internal_workbook: <FileText size={13} className="text-text-2" />,
  external_url: <ExternalLink size={13} className="text-text-2" />
};

const statusToneMap: Record<string, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  submitted: "ok",
  complete: "ok",
  approved: "ok",
  in_progress: "info",
  invited: "warn",
  draft: "neutral",
  blocked: "danger"
};

function statusLabel(status?: string | null): string {
  if (!status) return "Draft";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function workbookProgress(w: WorkbookRecord): number {
  // Workbook content shape varies — try to extract answered / total counts
  const c = w.workbookContent as
    | { answered?: number; total?: number; sections?: Array<{ answered?: number; total?: number }> }
    | null
    | undefined;
  if (!c) return 0;
  if (typeof c.answered === "number" && typeof c.total === "number" && c.total > 0) {
    return Math.round((c.answered / c.total) * 100);
  }
  if (Array.isArray(c.sections)) {
    let answered = 0;
    let total = 0;
    for (const s of c.sections) {
      answered += s.answered ?? 0;
      total += s.total ?? 0;
    }
    if (total > 0) return Math.round((answered / total) * 100);
  }
  // Fallback by status
  if (w.status === "submitted" || w.status === "complete") return 100;
  if (w.status === "in_progress") return 50;
  if (w.status === "invited") return 10;
  return 0;
}

function progressFraction(w: WorkbookRecord): { answered: number; total: number } {
  const c = w.workbookContent as
    | { answered?: number; total?: number; sections?: Array<{ answered?: number; total?: number }> }
    | null
    | undefined;
  if (c?.total && typeof c.answered === "number") {
    return { answered: c.answered, total: c.total };
  }
  if (Array.isArray(c?.sections)) {
    let answered = 0;
    let total = 0;
    for (const s of c.sections) {
      answered += s.answered ?? 0;
      total += s.total ?? 0;
    }
    return { answered, total };
  }
  return { answered: 0, total: 0 };
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface DiscoveryHubViewProps {
  projectId: string;
}

export default function DiscoveryHubView({ projectId }: DiscoveryHubViewProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [workbooks, setWorkbooks] = useState<WorkbookRecord[]>([]);
  const [contextItems, setContextItems] = useState<WorkbookRecord[]>([]);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [projRes, wbRes, evidenceRes, summaryRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/workbooks`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        // Pull all evidence (not just workbooks) to populate Context items
        fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery-summary`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const proj: ProjectSummary | null = projRes?.project ?? projRes ?? null;
      setProject(proj);

      const wb = Array.isArray(wbRes?.workbooks)
        ? (wbRes.workbooks as WorkbookRecord[])
        : [];
      setWorkbooks(wb);

      // Context items = evidence not classified as workbook
      const allEvidence = Array.isArray(evidenceRes?.evidence)
        ? (evidenceRes.evidence as WorkbookRecord[])
        : Array.isArray(evidenceRes?.items)
          ? (evidenceRes.items as WorkbookRecord[])
          : [];
      setContextItems(
        allEvidence.filter(
          (e) => !wb.some((w) => w.id === e.id)
        )
      );

      setSummary(
        (summaryRes?.summary ?? summaryRes ?? null) as DiscoverySummary | null
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [projectId]);

  async function handleRecrawlMiro() {
    setRefreshing(true);
    try {
      // Re-fetch evidence; server may have a Miro recrawl endpoint downstream
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/discovery/recrawl`,
        { method: "POST", credentials: "include" }
      ).catch(() => null);
      // Either way, refresh the lists
      await loadAll();
      if (r && !r.ok) {
        // Recrawl endpoint may not exist — refresh still happened
        return;
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`,
        { method: "POST", credentials: "include" }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Generate failed");
      }
      const body = await r.json();
      setSummary(body?.summary ?? null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGeneratingSummary(false);
    }
  }

  const filteredWorkbooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workbooks;
    return workbooks.filter((w) =>
      w.sourceLabel.toLowerCase().includes(q) ||
      (w.ownerName ?? "").toLowerCase().includes(q)
    );
  }, [workbooks, search]);

  const stats = useMemo(() => {
    const submitted = workbooks.filter(
      (w) => w.status === "submitted" || w.status === "complete"
    ).length;
    const inProgress = workbooks.filter((w) => w.status === "in_progress").length;
    const invited = workbooks.filter((w) => w.status === "invited").length;
    return {
      submitted,
      inProgress,
      invited,
      contextCount: contextItems.length,
      total: workbooks.length
    };
  }, [workbooks, contextItems]);

  const miroBoards = contextItems.filter(
    (c) => c.resourceType === "miro_board"
  );

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-text-1 transition-colors"
            >
              ← {project?.name ?? "Project workspace"}
            </Link>
          }
          title="Discovery"
          lede="Live activity for everything captured in discovery: workbooks, context items, Miro boards, and contributor inputs feeding the implementation plan."
          actions={
            <>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => void loadAll()}
                disabled={refreshing}
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </Btn>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => void handleGenerateSummary()}
                disabled={generatingSummary}
              >
                <Sparkles size={13} />
                {generatingSummary ? "Generating…" : "Generate AI summary"}
              </Btn>
              <Link href={`/projects/${projectId}/inputs`}>
                <Btn variant="primary" size="md">
                  <Plus size={13} />
                  Create workbook
                </Btn>
              </Link>
            </>
          }
        />

        {summaryError && (
          <p className="mb-3 text-[12px] text-status-danger">{summaryError}</p>
        )}

        <StatsGrid cols={4} className="mb-6">
          <Stat
            label="Workbooks"
            value={`${stats.submitted}/${stats.total}`}
            delta={
              stats.invited > 0
                ? `${stats.invited} awaiting contributor`
                : stats.inProgress > 0
                  ? `${stats.inProgress} in progress`
                  : "all submitted"
            }
            deltaTone={
              stats.invited > 0 ? "down" : stats.inProgress > 0 ? "neutral" : "up"
            }
          />
          <Stat
            label="Context items"
            value={String(stats.contextCount)}
            delta={
              miroBoards.length > 0
                ? `${miroBoards.length} Miro board${miroBoards.length === 1 ? "" : "s"}`
                : "no Miro boards yet"
            }
          />
          <Stat
            label="Sections answered"
            value={
              summary?.totalQuestions
                ? `${summary.answeredQuestions ?? 0}/${summary.totalQuestions}`
                : "—"
            }
            delta={summary ? "across all workbooks" : "no summary yet"}
          />
          <Stat
            label="Last update"
            value={
              workbooks[0]?.updatedAt
                ? relativeTime(workbooks[0].updatedAt)
                : "—"
            }
            delta="discovery activity"
          />
        </StatsGrid>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="min-w-0 flex flex-col gap-6">
            {/* WORKBOOKS */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                    Discovery workbooks
                  </h2>
                  <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                    Structured packs assigned to contributors. Click Open to
                    review or edit.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
                    />
                    <input
                      type="search"
                      placeholder="Search workbooks…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-ink-2 border border-ink-4 rounded-[10px] pl-8 pr-3 py-1.5 text-[12px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
                    />
                  </div>
                  <Link href={`/projects/${projectId}/inputs`}>
                    <Btn variant="ghost" size="sm">
                      <UserPlus size={11} />
                      Invite contributor
                    </Btn>
                  </Link>
                </div>
              </div>

              {loading ? (
                <Empty title="Loading workbooks…" sub="One moment." />
              ) : filteredWorkbooks.length === 0 ? (
                <Empty
                  icon={<FileText size={20} />}
                  title="No workbooks yet"
                  sub="Create discovery packs and assign them to the people who can answer."
                  action={
                    <Link href={`/projects/${projectId}/inputs`}>
                      <Btn variant="primary" size="sm">
                        <Plus size={12} />
                        Create workbook
                      </Btn>
                    </Link>
                  }
                />
              ) : (
                <Panel>
                  <PanelBody flush>
                    {filteredWorkbooks.map((w, i) => {
                      const pct = workbookProgress(w);
                      const frac = progressFraction(w);
                      const tone = statusToneMap[w.status ?? "draft"] ?? "neutral";
                      return (
                        <div
                          key={w.id}
                          className={`grid grid-cols-[minmax(0,1fr)_180px_120px_auto_auto] gap-3.5 items-center px-[18px] py-3 ${
                            i < filteredWorkbooks.length - 1
                              ? "border-b border-ink-4"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            {resourceIcon[w.resourceType ?? ""] ?? (
                              <FileText size={13} className="text-text-3" />
                            )}
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium truncate">
                                {w.sourceLabel}
                              </div>
                              {w.ownerName && (
                                <div className="text-[11.5px] text-text-3 truncate">
                                  Owner: {w.ownerName}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10.5px] font-mono text-text-3">
                                {frac.total > 0
                                  ? `${frac.answered}/${frac.total}`
                                  : ""}
                              </span>
                              <span className="text-[10.5px] font-mono text-text-2">
                                {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-ink-3 rounded">
                              <div
                                className={`h-full rounded ${
                                  tone === "danger"
                                    ? "bg-status-danger"
                                    : tone === "warn"
                                      ? "bg-status-warn"
                                      : "bg-status-ok"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <Pill tone={tone} dot>
                              {statusLabel(w.status)}
                            </Pill>
                          </div>
                          {w.sourceUrl ? (
                            <a
                              href={w.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Btn variant="ghost" size="sm">
                                Open
                                <ExternalLink size={11} />
                              </Btn>
                            </a>
                          ) : (
                            <Link
                              href={`/projects/${projectId}/inputs?workbook=${w.id}`}
                            >
                              <Btn variant="ghost" size="sm">
                                Open
                              </Btn>
                            </Link>
                          )}
                          <ChevronRight size={14} className="text-text-3" />
                        </div>
                      );
                    })}
                  </PanelBody>
                </Panel>
              )}
            </section>

            {/* CONTEXT ITEMS */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                    Context items
                  </h2>
                  <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                    Miro boards, Google Docs, PDFs, and links pulled into
                    discovery for synthesis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {miroBoards.length > 0 && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRecrawlMiro()}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      Recrawl Miro
                    </Btn>
                  )}
                  <Link href={`/projects/${projectId}/inputs?upload=1`}>
                    <Btn variant="ghost" size="sm">
                      <Upload size={11} />
                      Upload context
                    </Btn>
                  </Link>
                </div>
              </div>
              {contextItems.length === 0 ? (
                <Empty
                  icon={<ImageIcon size={20} />}
                  title="No context items yet"
                  sub="Upload PDFs, link Google Docs, or pull in Miro boards as discovery context."
                />
              ) : (
                <Panel>
                  <PanelBody flush>
                    {contextItems.map((c, i) => (
                      <div
                        key={c.id}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-3 items-center px-[18px] py-2.5 ${
                          i < contextItems.length - 1
                            ? "border-b border-ink-4"
                            : ""
                        }`}
                      >
                        {resourceIcon[c.resourceType ?? ""] ?? (
                          <FileText size={13} className="text-text-3" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {c.sourceLabel}
                          </div>
                          <div className="text-[11px] text-text-3 mt-0.5 truncate">
                            {c.resourceType?.replace(/_/g, " ") ?? c.evidenceType}
                            {" · "}
                            {relativeTime(c.updatedAt)}
                          </div>
                        </div>
                        <Pill tone={statusToneMap[c.status ?? "draft"] ?? "neutral"} dot>
                          {statusLabel(c.status)}
                        </Pill>
                        {c.sourceUrl ? (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Btn variant="ghost" size="sm">
                              <ExternalLink size={11} />
                            </Btn>
                          </a>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                  </PanelBody>
                </Panel>
              )}
            </section>
          </div>

          {/* RIGHT RAIL */}
          <aside className="flex flex-col gap-3.5 xl:sticky xl:top-[80px] self-start">
            <Panel>
              <PanelHead title="Quick actions" />
              <PanelBody className="grid gap-2">
                <Link href={`/projects/${projectId}/inputs`}>
                  <Btn variant="primary" size="sm" className="w-full justify-start">
                    <Plus size={12} />
                    Create workbook
                  </Btn>
                </Link>
                <Link href={`/projects/${projectId}/inputs`}>
                  <Btn variant="ghost" size="sm" className="w-full justify-start">
                    <UserPlus size={12} />
                    Invite contributor
                  </Btn>
                </Link>
                <Link href={`/projects/${projectId}/inputs?upload=1`}>
                  <Btn variant="ghost" size="sm" className="w-full justify-start">
                    <Upload size={12} />
                    Upload context item
                  </Btn>
                </Link>
                <Btn
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => void handleRecrawlMiro()}
                  disabled={refreshing}
                >
                  <RefreshCw size={12} />
                  Recrawl Miro boards
                </Btn>
                <Link href={`/projects/${projectId}/proposal`}>
                  <Btn variant="ghost" size="sm" className="w-full justify-start">
                    <Send size={12} />
                    Open discovery doc
                  </Btn>
                </Link>
              </PanelBody>
            </Panel>

            {summary?.sections && summary.sections.length > 0 && (
              <Panel>
                <PanelHead title="Synthesis" />
                <PanelBody flush>
                  {summary.sections.slice(0, 6).map((s, i, arr) => (
                    <div
                      key={s.sessionNumber}
                      className={`px-4 py-3 ${
                        i < arr.length - 1 ? "border-b border-ink-4" : ""
                      }`}
                    >
                      <div className="text-[12.5px] font-medium">
                        {s.title ?? `Section ${s.sessionNumber}`}
                      </div>
                      {s.fields && s.fields.length > 0 && (
                        <div className="text-[11.5px] text-text-3 mt-0.5">
                          {s.fields.length} field
                          {s.fields.length === 1 ? "" : "s"}
                          {s.status ? ` · ${s.status}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </PanelBody>
              </Panel>
            )}

            <Panel>
              <PanelHead title="Deep editor" />
              <PanelBody>
                <p className="text-[12.5px] text-text-2 m-0 mb-2.5">
                  Need to edit individual session fields, manage evidence, or
                  generate the blueprint?
                </p>
                <Link href={`/projects/${projectId}/discovery/edit`}>
                  <Btn variant="ghost" size="sm" className="w-full justify-start">
                    Open discovery studio
                    <ChevronRight size={12} />
                  </Btn>
                </Link>
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
