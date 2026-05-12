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
  Mic,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  UserPlus,
  X
} from "lucide-react";

import ProjectWorkspaceView from "./ProjectWorkspaceView";
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

interface MeetingNote {
  id: string;
  title: string;
  meetingDate: string;
  attendees: string[];
  notes: string | null;
  links: string[];
  createdAt: string;
  updatedAt: string;
}

const resourceIcon: Record<string, React.ReactNode> = {
  google_sheet: <FileSpreadsheet size={13} className="text-status-ok" />,
  google_doc: <FileText size={13} className="text-status-info" />,
  google_form: <FileText size={13} className="text-status-info" />,
  pdf: <FileText size={13} className="text-status-warn" />,
  miro_board: <Layers size={13} className="text-[#FFC766]" />,
  internal_workbook: <FileText size={13} className="text-text-2" />,
  external_url: <ExternalLink size={13} className="text-text-2" />,
  upload: <Upload size={13} className="text-status-info" />
};

const statusToneMap: Record<
  string,
  "ok" | "warn" | "danger" | "info" | "neutral"
> = {
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
  return status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function workbookProgress(w: WorkbookRecord): number {
  // Workbook content shape varies — try to extract answered / total counts
  const c = w.workbookContent as
    | {
        answered?: number;
        total?: number;
        sections?: Array<{ answered?: number; total?: number }>;
      }
    | null
    | undefined;
  if (!c) return 0;
  if (
    typeof c.answered === "number" &&
    typeof c.total === "number" &&
    c.total > 0
  ) {
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

function progressFraction(w: WorkbookRecord): {
  answered: number;
  total: number;
} {
  const c = w.workbookContent as
    | {
        answered?: number;
        total?: number;
        sections?: Array<{ answered?: number; total?: number }>;
      }
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
  const [sessions, setSessions] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDraft, setSessionDraft] = useState({
    title: "",
    notes: "",
    attendees: ""
  });
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState({
    resourceType: "miro_board",
    sourceLabel: "",
    sourceUrl: "",
    content: ""
  });
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  function resetContextDraft() {
    setContextDraft({
      resourceType: "miro_board",
      sourceLabel: "",
      sourceUrl: "",
      content: ""
    });
    setContextFile(null);
  }

  async function handleAddContext() {
    const isUpload = contextDraft.resourceType === "upload";
    if (isUpload) {
      if (!contextFile) {
        setContextError("Choose a file to upload");
        return;
      }
      if (contextFile.size > 20 * 1024 * 1024) {
        setContextError("File exceeds 20 MB limit");
        return;
      }
    } else {
      if (!contextDraft.sourceLabel.trim()) {
        setContextError("Label required");
        return;
      }
      if (!contextDraft.sourceUrl.trim() && !contextDraft.content.trim()) {
        setContextError("Provide a URL or paste content");
        return;
      }
    }
    setContextSaving(true);
    setContextError(null);
    try {
      if (isUpload && contextFile) {
        const fd = new FormData();
        fd.append("file", contextFile);
        const label =
          contextDraft.sourceLabel.trim() || contextFile.name;
        fd.append("sourceLabel", label);
        if (contextDraft.content.trim()) {
          fd.append("content", contextDraft.content.trim());
        }
        const r = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/uploads`,
          {
            method: "POST",
            credentials: "include",
            body: fd
          }
        );
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error ?? "Upload failed");
        }
      } else {
        const evidenceTypeByResource: Record<string, string> = {
          miro_board: "miro-note",
          google_doc: "uploaded-doc",
          google_sheet: "uploaded-doc",
          google_form: "uploaded-doc",
          pdf: "uploaded-doc",
          other_url: "website-link"
        };
        const evidenceType =
          evidenceTypeByResource[contextDraft.resourceType] ?? "uploaded-doc";
        const r = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/sessions/0/evidence`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              evidenceType,
              kind: "context",
              sourceLabel: contextDraft.sourceLabel.trim(),
              sourceUrl: contextDraft.sourceUrl.trim() || null,
              content: contextDraft.content.trim() || null,
              resourceType: contextDraft.resourceType,
              status: "linked"
            })
          }
        );
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.error ?? "Add context failed");
        }
      }
      await loadAll();
      setContextOpen(false);
      resetContextDraft();
    } catch (err) {
      setContextError(
        err instanceof Error ? err.message : "Add context failed"
      );
    } finally {
      setContextSaving(false);
    }
  }

  async function handleAddSession() {
    if (!sessionDraft.title.trim() && !sessionDraft.notes.trim()) {
      setSessionError("Add a title or notes to capture this session");
      return;
    }
    setSessionSaving(true);
    setSessionError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/meeting-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: sessionDraft.title.trim() || "Mini discovery session",
            notes: sessionDraft.notes.trim(),
            meetingDate: new Date().toISOString(),
            attendees: sessionDraft.attendees
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          })
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Capture failed");
      }
      const body = await r.json();
      const note: MeetingNote = body.note;
      setSessions((prev) => [note, ...prev]);
      setSessionOpen(false);
      setSessionDraft({ title: "", notes: "", attendees: "" });
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setSessionSaving(false);
    }
  }

  async function loadAll() {
    setRefreshing(true);
    try {
      const [projRes, wbRes, evidenceRes, summaryRes, sessionsRes] =
        await Promise.all([
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
          fetch(
            `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/meeting-notes`)
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
        allEvidence.filter((e) => !wb.some((w) => w.id === e.id))
      );

      setSummary(
        (summaryRes?.summary ?? summaryRes ?? null) as DiscoverySummary | null
      );

      const notes = Array.isArray(sessionsRes?.notes)
        ? (sessionsRes.notes as MeetingNote[])
        : [];
      setSessions(notes);
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
    return workbooks.filter(
      (w) =>
        w.sourceLabel.toLowerCase().includes(q) ||
        (w.ownerName ?? "").toLowerCase().includes(q)
    );
  }, [workbooks, search]);

  const stats = useMemo(() => {
    const submitted = workbooks.filter(
      (w) => w.status === "submitted" || w.status === "complete"
    ).length;
    const inProgress = workbooks.filter(
      (w) => w.status === "in_progress"
    ).length;
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
    <ProjectWorkspaceView projectId={projectId} activeTab="discovery">
      <div className="space-y-6">
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
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
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

        <StatsGrid cols={4}>
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
              stats.invited > 0
                ? "down"
                : stats.inProgress > 0
                  ? "neutral"
                  : "up"
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

        <div className="flex min-w-0 flex-col gap-6">
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
                    const tone =
                      statusToneMap[w.status ?? "draft"] ?? "neutral";
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

          {/* MINI DISCOVERY SESSIONS */}
          <section>
            <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                  Discovery sessions
                </h2>
                <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                  Mini sessions, ad-hoc calls, hallway findings — capture
                  context as you go without needing a full workbook.
                </p>
              </div>
              <Btn
                variant="primary"
                size="sm"
                onClick={() => {
                  setSessionError(null);
                  setSessionOpen(true);
                }}
              >
                <NotebookPen size={11} />
                Capture session
              </Btn>
            </div>
            {sessions.length === 0 ? (
              <Empty
                icon={<Mic size={20} />}
                title="No sessions captured yet"
                sub="Quick-capture findings from a call, workshop, or unstructured chat. Title + notes is enough."
                action={
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => setSessionOpen(true)}
                  >
                    <NotebookPen size={11} />
                    Capture first session
                  </Btn>
                }
              />
            ) : (
              <Panel>
                <PanelBody flush>
                  {sessions.slice(0, 6).map((s, i, arr) => {
                    const body = (s.notes ?? "").trim();
                    const preview =
                      body.length > 0
                        ? body.length > 280
                          ? `${body.slice(0, 280)}…`
                          : body
                        : "(no notes)";
                    return (
                      <div
                        key={s.id}
                        className={`px-[18px] py-3.5 ${
                          i < Math.min(sessions.length, 6) - 1
                            ? "border-b border-ink-4"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mic
                              size={12}
                              className="text-text-3 flex-shrink-0"
                            />
                            <span className="text-[13px] font-medium text-text-1 truncate">
                              {s.title || "Mini discovery session"}
                            </span>
                          </div>
                          <span className="text-[11px] text-text-3 font-mono whitespace-nowrap">
                            {new Date(s.meetingDate).toLocaleDateString()}
                          </span>
                        </div>
                        {s.attendees && s.attendees.length > 0 && (
                          <div className="text-[11.5px] text-text-3 mb-1.5">
                            {s.attendees.slice(0, 4).join(", ")}
                            {s.attendees.length > 4
                              ? ` +${s.attendees.length - 4}`
                              : ""}
                          </div>
                        )}
                        <p className="text-[12.5px] text-text-2 m-0 leading-[1.5] whitespace-pre-wrap">
                          {preview}
                        </p>
                      </div>
                    );
                  })}
                  {sessions.length > 6 && (
                    <div className="px-[18px] py-2.5 border-t border-ink-4 text-center">
                      <Link
                        href={`/projects/${projectId}/meetings`}
                        className="text-[12px] text-text-3 hover:text-text-1 transition-colors"
                      >
                        View all {sessions.length} sessions →
                      </Link>
                    </div>
                  )}
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
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContextError(null);
                    setContextOpen(true);
                  }}
                >
                  <Upload size={11} />
                  Add context source
                </Btn>
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
                      <Pill
                        tone={statusToneMap[c.status ?? "draft"] ?? "neutral"}
                        dot
                      >
                        {statusLabel(c.status)}
                      </Pill>
                      {c.sourceUrl ? (
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                          <Btn variant="ghost" size="sm">
                            {c.resourceType === "upload" ||
                            c.sourceUrl.startsWith("/api/files/") ? (
                              <>
                                <Upload size={11} />
                                Download
                              </>
                            ) : (
                              <ExternalLink size={11} />
                            )}
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

          {/* SYNTHESIS */}
          <section>
            <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                  Synthesis
                </h2>
                <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                  AI-generated key findings and delivery implications across
                  every workbook, session, and context source above.
                </p>
              </div>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => void handleGenerateSummary()}
                disabled={generatingSummary}
              >
                <Sparkles size={11} />
                {generatingSummary
                  ? "Generating…"
                  : summary
                    ? "Regenerate"
                    : "Generate"}
              </Btn>
            </div>
            {!summary || !summary.sections || summary.sections.length === 0 ? (
              <Empty
                icon={<Sparkles size={20} />}
                title="No synthesis yet"
                sub="Capture sessions, link context sources, complete workbooks — then regenerate to get key findings + delivery implications."
                action={
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => void handleGenerateSummary()}
                    disabled={generatingSummary}
                  >
                    <Sparkles size={11} />
                    {generatingSummary ? "Generating…" : "Generate synthesis"}
                  </Btn>
                }
              />
            ) : (
              <Panel>
                <PanelBody>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
                        Key findings
                      </p>
                      <ul className="m-0 pl-5 space-y-1.5 text-[12.5px] text-text-2 leading-[1.6]">
                        {summary.sections.slice(0, 6).map((s) => (
                          <li key={`finding_${s.sessionNumber}`}>
                            <span className="text-text-1 font-medium">
                              {s.title ?? `Section ${s.sessionNumber}`}
                            </span>
                            {s.fields && s.fields.length > 0 && (
                              <span className="text-text-3">
                                {" "}
                                · {s.fields.length} captured
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
                        Implications for delivery
                      </p>
                      <ul className="m-0 pl-5 space-y-1.5 text-[12.5px] text-text-2 leading-[1.6]">
                        <li>
                          {workbooks.length} workbook
                          {workbooks.length === 1 ? "" : "s"} feeding scope
                        </li>
                        <li>
                          {sessions.length} session
                          {sessions.length === 1 ? "" : "s"} captured —
                          {sessions.length === 0
                            ? " run mini discovery sessions for unstructured findings"
                            : " mine these for delivery context"}
                        </li>
                        <li>
                          {contextItems.length} context source
                          {contextItems.length === 1 ? "" : "s"}{" "}
                          {miroBoards.length > 0
                            ? `(${miroBoards.length} Miro board${miroBoards.length === 1 ? "" : "s"})`
                            : "linked"}
                        </li>
                        <li>
                          {summary.totalQuestions
                            ? `${summary.answeredQuestions ?? 0}/${summary.totalQuestions} sections answered — ${Math.round(
                                ((summary.answeredQuestions ?? 0) /
                                  summary.totalQuestions) *
                                  100
                              )}% complete`
                            : "Sections not yet structured"}
                        </li>
                      </ul>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            )}
          </section>
        </div>
      </div>

      {contextOpen && (
        <>
          <button
            type="button"
            aria-label="Close context source"
            onClick={() => !contextSaving && setContextOpen(false)}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
                  Discovery context
                </p>
                <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                  Add context source
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !contextSaving && setContextOpen(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-text-2 m-0 mb-3">
              Link a Miro board, Google Doc/Sheet, PDF, or any URL we should
              pull into discovery context. Synthesis will pick it up next time
              you regenerate.
            </p>
            <div className="grid gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold block mb-1.5">
                  Source type
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "miro_board", label: "Miro board" },
                    { id: "google_doc", label: "Google Doc" },
                    { id: "google_sheet", label: "Google Sheet" },
                    { id: "google_form", label: "Google Form" },
                    { id: "pdf", label: "PDF (link)" },
                    { id: "external_url", label: "Other URL" },
                    { id: "upload", label: "File upload" }
                  ].map((opt) => {
                    const isActive = contextDraft.resourceType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setContextDraft((d) => ({
                            ...d,
                            resourceType: opt.id
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-[10px] text-[12px] border transition-colors ${
                          isActive
                            ? "bg-[rgba(74,219,192,0.12)] text-status-ok border-[rgba(74,219,192,0.35)]"
                            : "bg-ink-2 text-text-2 border-ink-4 hover:border-ink-5 hover:text-text-1"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Label <span className="text-status-danger">*</span>
                </span>
                <input
                  autoFocus
                  value={contextDraft.sourceLabel}
                  onChange={(e) =>
                    setContextDraft((d) => ({
                      ...d,
                      sourceLabel: e.target.value
                    }))
                  }
                  placeholder={
                    contextDraft.resourceType === "miro_board"
                      ? "e.g. Sales process Miro board"
                      : contextDraft.resourceType === "google_doc"
                        ? "e.g. Brand guidelines v3"
                        : contextDraft.resourceType === "google_sheet"
                          ? "e.g. Lifecycle stages spreadsheet"
                          : "Source label"
                  }
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
                />
              </label>
              {contextDraft.resourceType === "upload" ? (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    File <span className="text-status-danger">*</span>
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setContextFile(f);
                      if (f && !contextDraft.sourceLabel.trim()) {
                        setContextDraft((d) => ({
                          ...d,
                          sourceLabel: f.name
                        }));
                      }
                    }}
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[12px] text-text-2 outline-none focus:border-[rgba(74,219,192,0.35)] file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-ink-3 file:text-text-1 file:text-[12px]"
                  />
                  <span className="block mt-1 text-[11px] text-text-3">
                    PDF, DOCX, PPTX, TXT, MD, or CSV · max 20 MB
                  </span>
                </label>
              ) : (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    URL
                  </span>
                  <input
                    type="url"
                    value={contextDraft.sourceUrl}
                    onChange={(e) =>
                      setContextDraft((d) => ({
                        ...d,
                        sourceUrl: e.target.value
                      }))
                    }
                    placeholder={
                      contextDraft.resourceType === "miro_board"
                        ? "https://miro.com/app/board/..."
                        : "https://"
                    }
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4 font-mono"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Notes (optional)
                </span>
                <textarea
                  value={contextDraft.content}
                  onChange={(e) =>
                    setContextDraft((d) => ({
                      ...d,
                      content: e.target.value
                    }))
                  }
                  placeholder="What's in here, why it matters for discovery, anything for the synthesiser to pick up…"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4 min-h-[100px] resize-y"
                />
              </label>
              {contextError && (
                <p className="text-[12px] text-status-danger m-0">
                  {contextError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn
                variant="ghost"
                size="md"
                onClick={() => {
                  setContextOpen(false);
                  resetContextDraft();
                }}
                disabled={contextSaving}
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                onClick={() => void handleAddContext()}
                disabled={
                  contextSaving ||
                  (contextDraft.resourceType === "upload"
                    ? !contextFile
                    : !contextDraft.sourceLabel.trim())
                }
              >
                <Upload size={12} />
                {contextSaving
                  ? contextDraft.resourceType === "upload"
                    ? "Uploading…"
                    : "Adding…"
                  : contextDraft.resourceType === "upload"
                    ? "Upload file"
                    : "Add source"}
              </Btn>
            </div>
          </div>
        </>
      )}

      {sessionOpen && (
        <>
          <button
            type="button"
            aria-label="Close capture"
            onClick={() => !sessionSaving && setSessionOpen(false)}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
                  Discovery
                </p>
                <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                  Capture mini discovery session
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !sessionSaving && setSessionOpen(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-text-2 m-0 mb-3">
              No structured questions, no workbook. Just title + raw notes from
              a call, workshop, hallway chat, Slack thread — anything worth
              capturing.
            </p>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Title
                </span>
                <input
                  autoFocus
                  value={sessionDraft.title}
                  onChange={(e) =>
                    setSessionDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder="e.g. Quick chat with sales lead — pipeline pain points"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Attendees (comma-separated)
                </span>
                <input
                  value={sessionDraft.attendees}
                  onChange={(e) =>
                    setSessionDraft((d) => ({
                      ...d,
                      attendees: e.target.value
                    }))
                  }
                  placeholder="e.g. Richard King, Jarrud"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Findings & context
                </span>
                <textarea
                  value={sessionDraft.notes}
                  onChange={(e) =>
                    setSessionDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  placeholder="Bullet points, raw quotes, follow-ups, anything that helps shape the build…"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4 min-h-[160px] resize-y"
                />
              </label>
              {sessionError && (
                <p className="text-[12px] text-status-danger m-0">
                  {sessionError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn
                variant="ghost"
                size="md"
                onClick={() => setSessionOpen(false)}
                disabled={sessionSaving}
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                onClick={() => void handleAddSession()}
                disabled={sessionSaving}
              >
                <NotebookPen size={12} />
                {sessionSaving ? "Capturing…" : "Capture session"}
              </Btn>
            </div>
          </div>
        </>
      )}
    </ProjectWorkspaceView>
  );
}
