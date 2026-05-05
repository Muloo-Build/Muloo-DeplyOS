"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  Flag,
  Folder,
  HelpCircle,
  Home,
  Info,
  KanbanSquare,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Trash2,
  User,
  X
} from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Bar } from "./ui/Bar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { HealthCell, HealthStrip } from "./ui/HealthStrip";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { SectionHead } from "./ui/SectionHead";
import { Tag } from "./ui/Tag";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "./ui/Tbl";

interface Workstream {
  id: string;
  name: string;
  category?: string | null;
  status?: string;
  owner?: string;
  summary?: string;
  estimatedHours?: number | null;
  hourCap?: number | null;
  scopeRisk?: string | null;
  deliveryOwner?: string | null;
  billingOwner?: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  status?: string;
  quoteApprovalStatus?: string | null;
  scopeLockedAt?: string | null;
  owner?: string | null;
  ownerEmail?: string | null;
  selectedHubs?: string[];
  hubsInScope?: string[];
  serviceFamily?: string;
  engagementType?: string;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  commercialBrief?: string | null;
  deliveryWorkstreams?: Workstream[];
  clientChampionFirstName?: string | null;
  clientChampionLastName?: string | null;
  clientChampionEmail?: string | null;
  client: {
    id: string;
    name: string;
    industry?: string | null;
    region?: string | null;
    website?: string | null;
  };
  portal?: {
    id?: string;
    portalId?: string;
    displayName?: string;
    connected?: boolean;
    hubDomain?: string | null;
  } | null;
  retainer?: {
    blockSize?: number;
    rate?: number;
    currency?: string;
    serviceLine?: string;
    status?: string;
  } | null;
  defaultWorkspacePath?: string;
  updatedAt?: string;
  createdAt?: string;
  isDraft?: boolean;
}

interface WorkstreamHoursEntry {
  workstreamId?: string;
  name?: string;
  used?: number;
  budgeted?: number;
  estimated?: number;
}

interface ActivityEntry {
  id: string;
  who: string;
  action: string;
  target: string;
  when: string;
  icon?: React.ReactNode;
}

interface QuoteRecord {
  id: string;
  reference?: string;
  version?: number;
  status?: string;
  projectId?: string;
  totals?: { grandTotalZar?: number };
  currency?: string;
  sharedAt?: string | null;
  approvedAt?: string | null;
  updatedAt?: string;
}

const projectTabs: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}> = [
  { id: "overview", label: "Overview", icon: <Home size={13} />, path: "" },
  { id: "discovery", label: "Discovery", icon: <Search size={13} />, path: "/discovery" },
  { id: "scope", label: "Scope", icon: <HelpCircle size={13} />, path: "/proposal" },
  { id: "delivery", label: "Delivery", icon: <KanbanSquare size={13} />, path: "/delivery" },
  { id: "comms", label: "Comms", icon: <MessageSquare size={13} />, path: "/inputs" },
  { id: "files", label: "Files", icon: <Folder size={13} />, path: "/audit" },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={13} />, path: "/edit" }
];

const pipelineDefs = [
  { id: "context", label: "Context" },
  { id: "discovery", label: "Discovery" },
  { id: "scope", label: "Scope & approval" },
  { id: "delivery", label: "Delivery" },
  { id: "qa", label: "QA" },
  { id: "handover", label: "Handover" }
];

function relativeDate(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusLabel(status?: string): string {
  if (!status) return "Active";
  const map: Record<string, string> = {
    in_delivery: "In delivery",
    "in-flight": "In flight",
    awaiting_approval: "Awaiting approval",
    blocked_external: "Blocked",
    shared: "Shared",
    live: "Live",
    completed: "Completed",
    archived: "Archived",
    discovery: "Discovery",
    draft: "Draft"
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function fmtMoney(n: number, currency = "ZAR"): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(n);
}

function pipelineState(project: ProjectRecord | null): {
  current: string;
  done: Set<string>;
} {
  if (!project) return { current: "context", done: new Set() };
  const done = new Set<string>();
  done.add("context");

  const status = project.status ?? "";
  const quote = project.quoteApprovalStatus ?? "draft";

  if (
    quote === "approved" ||
    project.scopeLockedAt ||
    status === "in_delivery" ||
    status === "completed" ||
    status === "live" ||
    status === "archived"
  ) {
    done.add("discovery");
    done.add("scope");
  } else if (quote === "shared") {
    done.add("discovery");
  }

  if (
    status === "in_delivery" ||
    status === "completed" ||
    status === "live" ||
    status === "archived"
  ) {
    done.add("delivery");
  }

  if (status === "completed" || status === "archived") {
    done.add("qa");
    done.add("handover");
  }

  let current = "context";
  for (const step of pipelineDefs) {
    if (!done.has(step.id)) {
      current = step.id;
      break;
    }
    if (step.id === "handover" && done.has("handover")) {
      current = "handover";
    }
  }
  return { current, done };
}

function workstreamPill(status?: string): {
  tone: "ok" | "warn" | "danger" | "neutral";
  label: string;
} {
  switch (status) {
    case "in_progress":
      return { tone: "ok", label: "In progress" };
    case "blocked":
      return { tone: "danger", label: "Blocked" };
    case "complete":
      return { tone: "ok", label: "Complete" };
    case "at_risk":
      return { tone: "warn", label: "At risk" };
    default:
      return { tone: "neutral", label: status?.replace(/_/g, " ") ?? "Planned" };
  }
}

function workstreamProgress(
  workstreamId: string,
  hours: WorkstreamHoursEntry[]
): number {
  const entry = hours.find(
    (h) => h.workstreamId === workstreamId || h.name === workstreamId
  );
  if (!entry) return 0;
  const denom = entry.budgeted ?? entry.estimated ?? 0;
  if (denom <= 0) return 0;
  return Math.min(100, Math.round(((entry.used ?? 0) / denom) * 100));
}

interface ProjectWorkspaceViewProps {
  projectId: string;
}

export default function ProjectWorkspaceView({ projectId }: ProjectWorkspaceViewProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [workstreamHours, setWorkstreamHours] = useState<WorkstreamHoursEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!project || deleteConfirm.trim() !== project.name) {
      setDeleteError("Type the project name exactly to confirm");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? `Delete failed (${r.status})`);
      }
      router.replace("/projects");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [projRes, hoursRes, quotesRes] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(
            `/api/projects/${encodeURIComponent(projectId)}/workstream-hours`
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/quotes")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        ]);

        if (cancelled) return;

        const proj: ProjectRecord | null = projRes?.project ?? projRes ?? null;
        setProject(proj);

        const hrs = Array.isArray(hoursRes?.workstreamHours)
          ? (hoursRes.workstreamHours as WorkstreamHoursEntry[])
          : [];
        setWorkstreamHours(hrs);

        const allQuotes: QuoteRecord[] = Array.isArray(quotesRes?.quotes)
          ? (quotesRes.quotes as QuoteRecord[])
          : [];
        setQuotes(allQuotes.filter((q) => q.projectId === projectId));

        // Synthesise activity from project record
        const acts: ActivityEntry[] = [];
        if (proj?.updatedAt) {
          acts.push({
            id: "updated",
            who: proj.owner ?? "Operator",
            action: "updated project",
            target: proj.name,
            when: relativeDate(proj.updatedAt),
            icon: <Edit3 size={12} />
          });
        }
        if (proj?.scopeLockedAt) {
          acts.push({
            id: "scope-locked",
            who: "System",
            action: "locked scope",
            target: "Scope approved",
            when: relativeDate(proj.scopeLockedAt),
            icon: <Check size={12} />
          });
        }
        if (proj?.createdAt) {
          acts.push({
            id: "created",
            who: proj.owner ?? "Operator",
            action: "created project",
            target: proj.name,
            when: relativeDate(proj.createdAt),
            icon: <Plus size={12} />
          });
        }
        setActivity(acts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const { current, done } = useMemo(() => pipelineState(project), [project]);

  const workstreams: Workstream[] = project?.deliveryWorkstreams ?? [];
  const hubs = project?.hubsInScope ?? project?.selectedHubs ?? [];

  const totalUsed = workstreamHours.reduce(
    (sum, h) => sum + (h.used ?? 0),
    0
  );
  const totalBudgeted = workstreamHours.reduce(
    (sum, h) => sum + (h.budgeted ?? h.estimated ?? 0),
    0
  );
  const hoursPct = totalBudgeted > 0 ? Math.round((totalUsed / totalBudgeted) * 100) : 0;

  const workstreamRiskCount = workstreams.filter(
    (w) => w.scopeRisk === "high" || w.status === "blocked"
  ).length;

  const stageLabelText = (() => {
    if (project?.status === "in_delivery") return "Delivery";
    if (project?.scopeLockedAt) return "Delivery";
    if (project?.quoteApprovalStatus === "approved") return "Delivery";
    if (project?.quoteApprovalStatus === "shared") return "Scope";
    return "Discovery";
  })();

  const stageTone =
    workstreamRiskCount > 0 ? "warn" : "ok";

  const portalConnected = Boolean(
    project?.portal?.connected || project?.portal?.portalId
  );

  const champion = (() => {
    if (!project) return null;
    const f = project.clientChampionFirstName?.trim();
    const l = project.clientChampionLastName?.trim();
    const name = [f, l].filter(Boolean).join(" ").trim();
    return name ? { name, email: project.clientChampionEmail ?? null } : null;
  })();

  const isDraft = project?.quoteApprovalStatus === "draft" || !project?.scopeLockedAt;

  const summaryText =
    project?.scopeExecutiveSummary ||
    project?.solutionRecommendation ||
    project?.problemStatement ||
    "No summary yet — fill in problem statement, solution recommendation, or executive summary.";

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        {/* HEADER */}
        <header className="flex items-start justify-between gap-6 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-text-3 mb-2">
              <Link href="/projects" className="hover:text-text-1 transition-colors">
                Projects
              </Link>
              {project?.client?.name && (
                <>
                  <ChevronRight size={11} className="text-text-4" />
                  <Link
                    href={`/clients/${project.client.id}`}
                    className="hover:text-text-1 transition-colors truncate"
                  >
                    {project.client.name}
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-[24px] font-semibold m-0 -tracking-[0.02em] text-text-1">
                {project?.name ?? (loading ? "Loading…" : "Project")}
              </h1>
              {project && (
                <Pill tone={stageTone} dot>
                  {stageLabelText}
                </Pill>
              )}
              {isDraft && project && <Tag>DRAFT</Tag>}
            </div>
            {project && (
              <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-text-3">
                {project.client?.name && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={12} />
                    {project.client.name}
                  </span>
                )}
                {project.owner && (
                  <span className="inline-flex items-center gap-1.5">
                    <User size={12} />
                    {project.owner}
                  </span>
                )}
                {totalBudgeted > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={12} />
                    <span className="font-mono">
                      {totalUsed}/{totalBudgeted}h
                    </span>
                    {project.retainer?.serviceLine && ` · ${project.retainer.serviceLine}`}
                  </span>
                )}
                {project.updatedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={12} />
                    Updated {relativeDate(project.updatedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/client/${projectId}`} target="_blank" rel="noreferrer">
              <Btn variant="ghost" size="md">
                <ExternalLink size={13} />
                Client portal
              </Btn>
            </Link>
            <Link href={`/projects/${projectId}/edit`}>
              <Btn variant="ghost" size="md">
                <Edit3 size={13} />
                Edit
              </Btn>
            </Link>
            <Btn variant="primary" size="md">
              <Plus size={13} />
              Log time
            </Btn>
            <Btn
              variant="danger"
              size="md"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
                setDeleteError(null);
              }}
              aria-label="Delete project"
              title="Delete project"
            >
              <Trash2 size={13} />
              Delete
            </Btn>
          </div>
        </header>

        {/* DELETE CONFIRM */}
        {deleteOpen && project && (
          <>
            <button
              type="button"
              aria-label="Close delete dialog"
              onClick={() => !deleting && setDeleteOpen(false)}
              className="fixed inset-0 z-40 bg-black/70"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(440px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-status-danger font-semibold">
                    Danger zone
                  </p>
                  <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                    Delete this project?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteOpen(false)}
                  className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-[13px] text-text-2 m-0 mb-3">
                Permanent. Workstreams, tasks, workbooks, contributors, quotes,
                portal access, and discovery data tied to this project are
                removed. Type the project name to confirm.
              </p>
              <div className="text-[11.5px] text-text-3 mb-1.5">Project name</div>
              <div className="font-mono text-[12.5px] bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-1.5 mb-3 select-all">
                {project.name}
              </div>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type to confirm"
                disabled={deleting}
                autoFocus
                className="w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none transition-colors focus:border-status-danger placeholder:text-text-4"
              />
              {deleteError && (
                <p className="mt-2 text-[12px] text-status-danger">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Btn
                  variant="ghost"
                  size="md"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Btn>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={
                    deleting || deleteConfirm.trim() !== project.name
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] font-semibold bg-status-danger text-[#2a0810] hover:bg-[#ff8090] border border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={13} />
                  {deleting ? "Deleting…" : "Delete project"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* HEALTH STRIP */}
        {project && (
          <HealthStrip className="mb-6">
            <HealthCell
              label="Stage"
              value={stageLabelText}
              sub={
                project.quoteApprovalStatus
                  ? `Quote ${project.quoteApprovalStatus}`
                  : statusLabel(project.status)
              }
              tone={stageTone}
            />
            <HealthCell
              label="Hours"
              value={
                totalBudgeted > 0 ? `${totalUsed}/${totalBudgeted}h` : "—"
              }
              sub={
                totalBudgeted > 0
                  ? `${hoursPct}% of phase budget`
                  : "no budget set"
              }
              tone={hoursPct > 90 ? "warn" : "ok"}
            />
            <HealthCell
              label="Decisions"
              value={
                workstreamRiskCount > 0
                  ? `${workstreamRiskCount} open`
                  : "all clear"
              }
              sub={
                workstreamRiskCount > 0
                  ? "see workstreams"
                  : "no blockers"
              }
              tone={workstreamRiskCount > 0 ? "warn" : "ok"}
            />
            <HealthCell
              label="Workstreams"
              value={`${workstreams.length}`}
              sub={`${hubs.length} hub${hubs.length === 1 ? "" : "s"}`}
              tone="ok"
            />
            <HealthCell
              label="Portal"
              value={portalConnected ? "Connected" : "Disconnected"}
              sub={
                portalConnected
                  ? project.portal?.displayName ??
                    `Portal ${project.portal?.portalId ?? ""}`.trim()
                  : "HubSpot not yet linked"
              }
              tone={portalConnected ? "ok" : "muted"}
            />
          </HealthStrip>
        )}

        {/* 3-COL BODY */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px] items-start">
          {/* LEFT RAIL */}
          <aside className="flex flex-col gap-px sticky top-[80px] self-start">
            <div className="px-3 pt-3 pb-1.5 text-[10px] tracking-[0.14em] uppercase text-text-4 font-semibold">
              Project pipeline
            </div>
            {pipelineDefs.map((s) => {
              const isDone = done.has(s.id);
              const isCurrent = s.id === current && !isDone;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[12.5px] transition-colors cursor-default ${
                    isCurrent
                      ? "bg-ink-2 text-text-1 shadow-[inset_2px_0_0_var(--accent)]"
                      : isDone
                        ? "text-text-2"
                        : "text-text-3"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full grid place-items-center flex-shrink-0 ${
                      isDone
                        ? "bg-status-ok border-status-ok"
                        : isCurrent
                          ? "border-[1.5px] border-ink-5"
                          : "border-[1.5px] border-ink-5 border-dashed"
                    }`}
                  >
                    {isDone && <Check size={9} className="text-[#042822]" />}
                  </span>
                  <span className="flex-1 truncate">{s.label}</span>
                </div>
              );
            })}
            <div className="px-3 pt-4 pb-1.5 text-[10px] tracking-[0.14em] uppercase text-text-4 font-semibold">
              Workstreams
            </div>
            {workstreams.length === 0 ? (
              <div className="px-3 py-1.5 text-[12px] text-text-4">None yet.</div>
            ) : (
              workstreams.slice(0, 8).map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] text-text-2 hover:bg-ink-2 transition-colors"
                >
                  <span className="font-mono text-[10.5px] text-text-4 min-w-[36px]">
                    WS-{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate">{w.name}</span>
                  {(w.status === "blocked" || w.scopeRisk === "high") && (
                    <AlertTriangle size={11} className="text-status-warn" />
                  )}
                </div>
              ))
            )}
          </aside>

          {/* CENTER */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Tab bar */}
            <div className="flex gap-0.5 border-b border-ink-4 overflow-x-auto -mx-1 px-1">
              {projectTabs.map((t) => {
                const isActive = t.id === "overview";
                const href = `/projects/${projectId}${t.path}`;
                return (
                  <Link
                    key={t.id}
                    href={href}
                    className={`px-3.5 py-2.5 text-[13px] cursor-pointer border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? "text-text-1 border-status-ok"
                        : "text-text-3 border-transparent hover:text-text-2"
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* OVERVIEW CONTENT */}
            <Panel>
              <PanelHead
                title="Project summary"
                right={
                  <Link href={`/projects/${projectId}/edit`}>
                    <Btn variant="ghost" size="icon" aria-label="Edit summary">
                      <Edit3 size={12} />
                    </Btn>
                  </Link>
                }
              />
              <PanelBody className="grid gap-3.5">
                <p className="m-0 text-[13.5px] text-text-2 leading-[1.6]">
                  {summaryText}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {project?.problemStatement && (
                    <MetaItem
                      k="Why we're doing this"
                      v={project.problemStatement}
                    />
                  )}
                  {hubs.length > 0 && (
                    <MetaItem k="Hubs" v={hubs.join(" + ")} />
                  )}
                  {project?.engagementType && (
                    <MetaItem
                      k="Engagement"
                      v={
                        statusLabel(project.engagementType.toLowerCase()) ??
                        project.engagementType
                      }
                    />
                  )}
                  {champion && (
                    <MetaItem
                      k="Champion"
                      v={champion.name}
                    />
                  )}
                  {project?.retainer && (
                    <MetaItem
                      k="Retainer"
                      v={`${project.retainer.blockSize ?? "—"}h · ${
                        project.retainer.currency ?? "ZAR"
                      } ${project.retainer.rate ?? "—"}/h`}
                    />
                  )}
                  {project?.commercialBrief && (
                    <MetaItem k="Commercial" v={project.commercialBrief} />
                  )}
                </div>
              </PanelBody>
            </Panel>

            {/* WORKSTREAMS */}
            <section>
              <SectionHead
                title="Workstreams"
                right={
                  <Btn variant="ghost" size="sm">
                    <Plus size={12} />
                    Add workstream
                  </Btn>
                }
              />
              {workstreams.length === 0 ? (
                <Empty
                  icon={<KanbanSquare size={20} />}
                  title="No workstreams yet"
                  sub="Add workstreams to break this project into deliverable units."
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {workstreams.map((w, idx) => {
                    const pill = workstreamPill(w.status);
                    const progress = workstreamProgress(w.id, workstreamHours);
                    const owner = w.deliveryOwner ?? w.owner ?? "—";
                    const hours = w.estimatedHours ?? w.hourCap ?? 0;
                    const risks =
                      (w.scopeRisk === "high" ? 1 : 0) +
                      (w.status === "blocked" ? 1 : 0);
                    return (
                      <div
                        key={w.id}
                        className="bg-ink-1 border border-ink-4 rounded-[14px] p-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-center hover:border-ink-5 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold m-0 mb-1 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10.5px] text-text-4 bg-ink-2 px-1.5 py-0.5 rounded font-medium">
                              WS-{String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate">{w.name}</span>
                            <Pill tone={pill.tone} dot>
                              {pill.label}
                            </Pill>
                          </div>
                          {w.summary && (
                            <p className="text-[12.5px] text-text-3 m-0 mb-2.5 line-clamp-2">
                              {w.summary}
                            </p>
                          )}
                          <Bar value={progress} tone={pill.tone === "danger" ? "danger" : pill.tone === "warn" ? "warn" : "ok"} />
                          <div className="flex items-center gap-4 text-[11.5px] text-text-3 mt-2 flex-wrap">
                            <span>
                              <span className="text-text-2 font-medium">
                                {owner}
                              </span>{" "}
                              owner
                            </span>
                            {hours > 0 && (
                              <span className="font-mono">{hours}h</span>
                            )}
                            <span>{progress}% complete</span>
                            {risks > 0 && (
                              <span className="text-status-warn flex items-center gap-1">
                                <AlertTriangle size={11} />
                                {risks} risk{risks > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <Btn variant="ghost" size="sm">
                          <ArrowRight size={12} />
                        </Btn>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SOLD VS DISCOVERED */}
            <section>
              <SectionHead
                title="Sold vs discovered"
                right={
                  <span className="text-[12px] text-text-3">
                    Variance check between proposal and discovery
                  </span>
                }
              />
              <SoldVsDiscovered
                workstreams={workstreams}
                hours={workstreamHours}
              />
            </section>
          </div>

          {/* RIGHT RAIL */}
          <aside className="hidden xl:flex flex-col gap-3.5 sticky top-[80px] self-start">
            <Panel>
              <PanelHead
                title="Next actions"
                right={
                  workstreamRiskCount > 0 ? (
                    <Pill tone="warn" dot>
                      {workstreamRiskCount}
                    </Pill>
                  ) : (
                    <Pill tone="ok" dot>
                      0
                    </Pill>
                  )
                }
              />
              <PanelBody flush>
                {workstreamRiskCount === 0 ? (
                  <div className="px-4 py-4 text-text-3 text-[12.5px]">
                    No urgent actions.
                  </div>
                ) : (
                  workstreams
                    .filter(
                      (w) => w.status === "blocked" || w.scopeRisk === "high"
                    )
                    .slice(0, 3)
                    .map((w, i, arr) => (
                      <div
                        key={w.id}
                        className={`px-4 py-3 ${
                          i < arr.length - 1 ? "border-b border-ink-4" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Pill
                            tone={w.status === "blocked" ? "danger" : "warn"}
                            dot
                          >
                            <span className="sr-only">flag</span>
                          </Pill>
                          <span className="text-[12.5px] font-medium truncate">
                            {w.status === "blocked"
                              ? `Unblock ${w.name}`
                              : `Review risk on ${w.name}`}
                          </span>
                        </div>
                        {w.summary && (
                          <div className="text-[11.5px] text-text-3 pl-6 line-clamp-2">
                            {w.summary}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Client"
                right={
                  project?.client?.id ? (
                    <Link href={`/clients/${project.client.id}`}>
                      <Btn variant="ghost" size="icon" aria-label="Open client">
                        <ExternalLink size={12} />
                      </Btn>
                    </Link>
                  ) : null
                }
              />
              <PanelBody className="grid gap-3">
                {project?.client && (
                  <div className="flex items-center gap-2.5">
                    <Avatar size="lg" initials={project.client.name.slice(0, 2)} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">
                        {project.client.name}
                      </div>
                      <div className="text-[11.5px] text-text-3 truncate">
                        {project.client.industry ?? "—"}
                        {project.client.region ? ` · ${project.client.region}` : ""}
                      </div>
                    </div>
                  </div>
                )}
                {champion && (
                  <div className="flex flex-wrap gap-3.5 pt-1">
                    <MetaItem k="Champion" v={champion.name} />
                    {champion.email && (
                      <MetaItem
                        k="Email"
                        v={
                          <span className="font-mono text-[11.5px] break-all">
                            {champion.email}
                          </span>
                        }
                      />
                    )}
                  </div>
                )}
                <div className="h-px bg-ink-4 my-1" />
                <div>
                  <div className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold mb-1.5">
                    HubSpot portal
                  </div>
                  <div className="flex items-center justify-between bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-2">
                    <span
                      className={`text-[12px] flex items-center gap-1.5 ${
                        portalConnected ? "text-status-ok" : "text-status-danger"
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          portalConnected ? "bg-status-ok" : "bg-status-danger"
                        }`}
                      />
                      {portalConnected ? "Connected" : "Disconnected"}
                    </span>
                    <Btn variant="ghost" size="sm">
                      {portalConnected ? "Manage" : "Connect"}
                    </Btn>
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Quotes"
                right={
                  <Link href={`/quotes/new?projectId=${projectId}`}>
                    <Btn variant="ghost" size="sm" aria-label="New quote">
                      <Plus size={12} />
                    </Btn>
                  </Link>
                }
              />
              <PanelBody flush>
                {quotes.length === 0 ? (
                  <div className="px-4 py-4 text-text-3 text-[12.5px]">
                    No quotes for this project yet.
                  </div>
                ) : (
                  quotes.map((q, i) => {
                    const tone =
                      q.status === "approved" || q.status === "won"
                        ? "ok"
                        : q.status === "lost" || q.status === "archived"
                          ? "danger"
                          : q.status === "shared"
                            ? "info"
                            : "neutral";
                    const total = q.totals?.grandTotalZar;
                    return (
                      <Link
                        key={q.id}
                        href={`/quotes/${q.id}`}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center px-4 py-2.5 hover:bg-ink-2 transition-colors ${
                          i < quotes.length - 1 ? "border-b border-ink-4" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[12.5px] font-medium truncate">
                            <Receipt size={11} className="text-text-3 flex-shrink-0" />
                            <span className="font-mono">
                              {q.reference ?? q.id.slice(0, 8)}
                            </span>
                            {q.version && (
                              <span className="text-text-4 font-mono text-[10.5px]">
                                v{q.version}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-3 mt-0.5 flex items-center gap-1.5">
                            <Pill tone={tone} dot>
                              {q.status ?? "draft"}
                            </Pill>
                            {typeof total === "number" && (
                              <span className="font-mono">
                                {new Intl.NumberFormat("en-ZA", {
                                  style: "currency",
                                  currency: q.currency ?? "ZAR",
                                  maximumFractionDigits: 0
                                }).format(total)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-text-3" />
                      </Link>
                    );
                  })
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead title="Recent activity" />
              <PanelBody>
                {activity.length === 0 ? (
                  <div className="text-text-3 text-[12.5px] text-center py-2">
                    No activity yet.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {activity.map((a, i) => (
                      <div
                        key={a.id}
                        className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 relative pb-4 last:pb-0"
                      >
                        {i < activity.length - 1 && (
                          <span className="absolute left-[13px] top-[22px] bottom-0 w-px bg-ink-4" />
                        )}
                        <div className="w-7 h-7 rounded-full bg-ink-2 border border-ink-4 grid place-items-center text-text-3 z-[1]">
                          {a.icon ?? <Info size={12} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
                            <span className="text-text-1 font-medium">
                              {a.who}
                            </span>
                            <span className="text-text-3 text-[11.5px]">
                              {a.action}
                            </span>
                            <span className="text-text-3 text-[11.5px] ml-auto font-mono">
                              {a.when}
                            </span>
                          </div>
                          <div className="text-[12.5px] text-text-2 mt-1 truncate">
                            {a.target}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function MetaItem({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
        {k}
      </div>
      <div className="text-[12.5px] text-text-2 mt-0.5">{v}</div>
    </div>
  );
}

function SoldVsDiscovered({
  workstreams,
  hours
}: {
  workstreams: Workstream[];
  hours: WorkstreamHoursEntry[];
}) {
  if (workstreams.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <Empty
            icon={<HelpCircle size={20} />}
            title="No scope items yet"
            sub="Add workstreams to start tracking variance against the original quote."
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Tbl>
      <THead>
        <Tr>
          <Th>Workstream</Th>
          <Th>Category</Th>
          <Th>Quoted</Th>
          <Th>Used</Th>
          <Th>Variance</Th>
          <Th>Status</Th>
        </Tr>
      </THead>
      <TBody>
        {workstreams.map((w, idx) => {
          const entry = hours.find(
            (h) => h.workstreamId === w.id || h.name === w.name
          );
          const quoted = w.estimatedHours ?? w.hourCap ?? entry?.budgeted ?? 0;
          const used = entry?.used ?? 0;
          const variance = used - quoted;
          const tone =
            variance > 0 ? "warn" : variance < 0 ? "ok" : "neutral";
          return (
            <Tr key={w.id}>
              <Td>
                <CellPrimary
                  sub={`WS-${String(idx + 1).padStart(2, "0")}`}
                >
                  {w.name}
                </CellPrimary>
              </Td>
              <Td muted>{w.category ?? "—"}</Td>
              <Td>
                <span className="font-mono">{quoted}h</span>
              </Td>
              <Td>
                <span className="font-mono">{used}h</span>
              </Td>
              <Td>
                <span
                  className={`font-mono ${
                    variance > 0
                      ? "text-status-warn"
                      : variance < 0
                        ? "text-status-ok"
                        : "text-text-2"
                  }`}
                >
                  {variance > 0 ? "+" : ""}
                  {variance}h
                </span>
              </Td>
              <Td>
                <Pill tone={tone === "neutral" ? "neutral" : tone} dot>
                  {tone === "warn"
                    ? "Over"
                    : tone === "ok"
                      ? "Under"
                      : "On track"}
                </Pill>
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Tbl>
  );
}
