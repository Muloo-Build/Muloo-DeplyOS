"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Radar,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";

import AppShell from "./AppShell";
import { Bar } from "./ui/Bar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { SectionHead } from "./ui/SectionHead";

interface ProjectListItem {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  stage?: string | null;
  hubs?: string[];
  progress?: number;
  hours?: { used?: number; allocated?: number; period?: string };
  nextAction?: string;
  health?: "ok" | "warn" | "danger";
  href?: string;
  updatedAt?: string;
}

interface NeedsAttentionItem {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  href: string;
  reason: string;
  reasonKey: string;
  age: string;
  status: string;
  urgencyScore: number;
}

interface InboxItem {
  id: string;
  kind: string;
  subject: string;
  from: string;
  project?: string | null;
  when: string;
  href?: string;
  priority?: "info" | "warn" | "danger";
}

interface ClientEmailQueue {
  clientId: string;
  clientName: string;
  gmailLabel: string;
  unreadCount: number;
  projects?: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt?: string;
  }>;
  emails?: Array<{
    id: string;
    subject: string;
    from: string;
    date?: string;
    gmailUrl?: string;
    unread?: boolean;
  }>;
}

interface CapacitySegment {
  label: string;
  used: number;
  alloc: number;
  tone?: "ok" | "warn" | "danger";
}

const activeStatuses = new Set([
  "active",
  "draft",
  "scoping",
  "designed",
  "ready-for-execution",
  "in-flight",
  "in_delivery",
  "awaiting_approval",
  "blocked_external",
  "live"
]);

function statusLabel(status?: string): string {
  if (!status) return "Active";
  const map: Record<string, string> = {
    active: "Active",
    draft: "Draft",
    scoping: "Scoping",
    designed: "Designed",
    "ready-for-execution": "Ready for execution",
    "in-flight": "In flight",
    in_delivery: "In delivery",
    awaiting_approval: "Awaiting approval",
    blocked_external: "Blocked externally",
    live: "Live",
    completed: "Completed",
    archived: "Archived"
  };
  return map[status] ?? status.replace(/[_-]/g, " ");
}

function relativeTime(iso?: string): string {
  if (!iso) return "fresh enough";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(diff / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function normaliseProjects(payload: unknown): ProjectListItem[] {
  const source = payload as
    | { projects?: unknown; items?: unknown }
    | ProjectListItem[]
    | null;
  if (Array.isArray(source)) return source;
  if (source && Array.isArray(source.projects))
    return source.projects as ProjectListItem[];
  if (source && Array.isArray(source.items))
    return source.items as ProjectListItem[];
  return [];
}

function normaliseInbox(payload: unknown): InboxItem[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const submissions = Array.isArray(data.submissionAlerts)
    ? data.submissionAlerts
    : [];

  const messageRows: InboxItem[] = messages.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    const body = String(row.body ?? "Project message").trim();
    const project = row.project as Record<string, unknown> | undefined;
    const senderType = String(row.senderType ?? "");
    return {
      id: `msg_${String(row.id ?? index)}`,
      kind: senderType === "client" ? "Client message" : "Internal note",
      subject: body.length > 90 ? `${body.slice(0, 90)}…` : body,
      from: String(row.senderName ?? "—"),
      project: project?.name ? String(project.name) : null,
      when: relativeTime(String(row.createdAt ?? "")),
      href: row.projectId ? `/projects/${String(row.projectId)}` : "/inbox",
      priority: senderType === "client" ? "warn" : "info"
    };
  });

  const submissionRows: InboxItem[] = submissions.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    const project = row.project as Record<string, unknown> | undefined;
    return {
      id: `sub_${String(project?.id ?? index)}`,
      kind: "Client input",
      subject: `${String(row.submittedByName ?? "Client")} updated discovery inputs`,
      from: String(row.submittedByName ?? "Client"),
      project: project?.name ? String(project.name) : null,
      when: relativeTime(String(row.updatedAt ?? "")),
      href: project?.id ? `/projects/${String(project.id)}/inputs` : "/inbox",
      priority: "info"
    };
  });

  return [...messageRows, ...submissionRows];
}

function healthTone(project: ProjectListItem): "ok" | "warn" | "danger" {
  if (project.health) return project.health;
  if (project.status === "blocked_external") return "danger";
  if (project.status === "awaiting_approval" || project.status === "scoping")
    return "warn";
  return "ok";
}

export default function SkippyMulooWorldView() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [attention, setAttention] = useState<NeedsAttentionItem[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [emailQueues, setEmailQueues] = useState<ClientEmailQueue[]>([]);
  const [capacity, setCapacity] = useState<CapacitySegment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [chatMode, setChatMode] = useState<"ask" | "pickup">("pickup");
  const [chatDraft, setChatDraft] = useState("");
  const [chatStatus, setChatStatus] = useState<{
    tone: "ok" | "warn" | "danger";
    message: string;
  } | null>(null);

  async function loadWorld() {
    setRefreshing(true);
    try {
      const [projectRes, attentionRes, inboxRes, gmailRes, capacityRes] =
        await Promise.all([
          fetch("/api/projects")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/projects/needs-attention")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/inbox")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/workspace/emails/client-queues")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/capacity")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        ]);

      setProjects(normaliseProjects(projectRes));
      setAttention(
        Array.isArray(attentionRes?.items) ? attentionRes.items.slice(0, 8) : []
      );
      setInbox(normaliseInbox(inboxRes).slice(0, 8));
      setEmailQueues(
        gmailRes?.connected && Array.isArray(gmailRes.queues)
          ? (gmailRes.queues as ClientEmailQueue[]).slice(0, 6)
          : []
      );

      if (Array.isArray(capacityRes?.segments)) {
        setCapacity(capacityRes.segments.slice(0, 6));
      } else if (Array.isArray(capacityRes?.buckets)) {
        setCapacity(
          capacityRes.buckets
            .slice(0, 6)
            .map((b: { label: string; used: number; allocated: number }) => ({
              label: b.label,
              used: b.used,
              alloc: b.allocated
            }))
        );
      } else {
        setCapacity([]);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadWorld();
  }, []);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.status || activeStatuses.has(p.status)),
    [projects]
  );

  const radarItems = useMemo(() => {
    const blockers = attention.filter((item) => item.reasonKey === "overdue");
    const approvals = attention.filter(
      (item) =>
        item.reasonKey === "awaiting_client" ||
        item.reasonKey === "blueprint_approved_no_delivery"
    );
    const flaggedProjects = activeProjects.filter(
      (project) => healthTone(project) !== "ok"
    );
    const unreadEmailCount = emailQueues.reduce(
      (sum, queue) => sum + (queue.unreadCount ?? 0),
      0
    );

    return [
      {
        label: "Client work I can move",
        value: activeProjects.length,
        detail: `${activeProjects.filter((p) => p.nextAction).length} have a next action captured`,
        tone: activeProjects.length > 0 ? "ok" : "neutral"
      },
      {
        label: "On my radar",
        value: attention.length + flaggedProjects.length,
        detail:
          blockers.length > 0
            ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}`
            : "no hard blockers flagged",
        tone:
          blockers.length > 0 ? "danger" : attention.length > 0 ? "warn" : "ok"
      },
      {
        label: "Client replies / inputs",
        value: inbox.length + unreadEmailCount,
        detail: `${approvals.length} approval/input loop${approvals.length === 1 ? "" : "s"}`,
        tone: inbox.length + unreadEmailCount > 0 ? "warn" : "ok"
      },
      {
        label: "Muloo delivery world",
        value: new Set(activeProjects.map((p) => p.clientName).filter(Boolean))
          .size,
        detail: "active client accounts in play",
        tone: "neutral"
      }
    ] as const;
  }, [activeProjects, attention, emailQueues, inbox.length]);

  useEffect(() => {
    if (!selectedProjectId && activeProjects.length > 0) {
      setSelectedProjectId(activeProjects[0].id);
    }
  }, [activeProjects, selectedProjectId]);

  const selectedProject = useMemo(
    () =>
      activeProjects.find((project) => project.id === selectedProjectId) ??
      null,
    [activeProjects, selectedProjectId]
  );

  async function sendSkippyIntake() {
    if (!selectedProjectId) {
      setChatStatus({
        tone: "warn",
        message: "Pick a project first so the thread has a home."
      });
      return;
    }
    const trimmed = chatDraft.trim();
    if (!trimmed) {
      setChatStatus({
        tone: "warn",
        message:
          "Give Skippy something to work with. Mind-reading module is still in procurement."
      });
      return;
    }

    setChatStatus(null);
    const selectedName = selectedProject?.name ?? "selected project";
    const prefix =
      chatMode === "pickup" ? "[Skippy pickup request]" : "[Skippy question]";
    const body = `${prefix}
Project: ${selectedName}

${trimmed}`;

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(selectedProjectId)}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderName: "Skippy intake", body })
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Could not send this to Skippy intake"
        );
      }
      setChatDraft("");
      setChatStatus({
        tone: "ok",
        message:
          chatMode === "pickup"
            ? `Captured. Skippy has a pickup request parked on ${selectedName}.`
            : `Captured. Your question is logged against ${selectedName}.`
      });
      await loadWorld();
    } catch (error) {
      setChatStatus({
        tone: "danger",
        message: error instanceof Error ? error.message : "Skippy intake failed"
      });
    }
  }

  const topClientLanes = useMemo(() => {
    const byClient = new Map<
      string,
      { client: string; projects: ProjectListItem[]; unread: number }
    >();
    for (const project of activeProjects) {
      const client = project.clientName ?? "Unassigned client";
      const lane = byClient.get(client) ?? { client, projects: [], unread: 0 };
      lane.projects.push(project);
      byClient.set(client, lane);
    }
    for (const queue of emailQueues) {
      const lane = byClient.get(queue.clientName) ?? {
        client: queue.clientName,
        projects: [],
        unread: 0
      };
      lane.unread += queue.unreadCount ?? 0;
      byClient.set(queue.clientName, lane);
    }
    return Array.from(byClient.values())
      .sort(
        (a, b) => b.projects.length + b.unread - (a.projects.length + a.unread)
      )
      .slice(0, 8);
  }, [activeProjects, emailQueues]);

  const skippyCanDo = [
    "Turn recent emails, meeting notes and discovery inputs into project tasks or client follow-ups.",
    "Import Gemini meeting intelligence into a project with auditable [Gemini] tasks.",
    "Draft HubSpot-safe execution plans and keep writes approval-gated by default.",
    "Surface blockers, approvals, stale projects and waiting-on-client loops before they vanish into the swamp.",
    "Package client-ready next actions so Jarrud can approve, send or park them. Tiny cockpit. Fewer fires."
  ];

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Skippy · Muloo world"
          title="Client work radar"
          lede="A single view of what Skippy can help move, what is on the radar, and where Muloo delivery needs attention. No treasure hunt."
          actions={
            <>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => void loadWorld()}
                disabled={refreshing}
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh radar
              </Btn>
              <Link href="/projects">
                <Btn variant="primary" size="md">
                  Open projects <ArrowRight size={14} />
                </Btn>
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
          {radarItems.map((item) => (
            <Panel key={item.label}>
              <PanelBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10.5px] tracking-[0.12em] uppercase text-text-3 font-semibold mb-1">
                      {item.label}
                    </div>
                    <div className="text-[30px] font-semibold -tracking-[0.03em] tnum">
                      {item.value}
                    </div>
                    <div className="text-[12px] text-text-3 mt-1">
                      {item.detail}
                    </div>
                  </div>
                  <Pill
                    tone={item.tone === "neutral" ? "neutral" : item.tone}
                    dot
                  >
                    {item.tone === "danger"
                      ? "Watch"
                      : item.tone === "warn"
                        ? "Review"
                        : "Clear"}
                  </Pill>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="flex flex-col gap-6 min-w-0">
            <section>
              <SectionHead
                title="Client work Skippy can move"
                right={
                  <Link href="/projects">
                    <Btn variant="ghost" size="sm">
                      View all work <ArrowRight size={12} />
                    </Btn>
                  </Link>
                }
              />
              {activeProjects.length === 0 ? (
                <Empty
                  icon={<BriefcaseBusiness size={20} />}
                  title="No active client work found"
                  sub="Create or activate projects so Skippy has something real to operate against."
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {activeProjects.slice(0, 10).map((project) => (
                    <ProjectRadarCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHead title="On Skippy's radar" />
              {attention.length === 0 ? (
                <Panel>
                  <PanelBody>
                    <Empty
                      icon={<CheckCircle2 size={20} />}
                      title="Nothing urgent flagged"
                      sub="No overdue, approval or stuck-work signals are currently coming through the project radar."
                    />
                  </PanelBody>
                </Panel>
              ) : (
                <Panel>
                  {attention.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3.5 items-center px-[18px] py-3.5 hover:bg-ink-2 transition-colors ${
                        index < attention.length - 1
                          ? "border-b border-ink-4"
                          : ""
                      }`}
                    >
                      <RadarIcon reasonKey={item.reasonKey} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {item.reason}
                        </div>
                        <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                          {item.clientName ? `${item.clientName} · ` : ""}
                          {item.projectName}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-text-3 whitespace-nowrap">
                        {item.age}
                      </span>
                    </Link>
                  ))}
                </Panel>
              )}
            </section>

            <section>
              <SectionHead title="Client inbox and follow-up signals" />
              {inbox.length === 0 && emailQueues.length === 0 ? (
                <Panel>
                  <PanelBody>
                    <Empty
                      icon={<Inbox size={20} />}
                      title="No client inbox signals"
                      sub="Gmail/client queues and project messages are not currently flagging follow-up work."
                    />
                  </PanelBody>
                </Panel>
              ) : (
                <Panel>
                  {[...inbox, ...emailQueues.flatMap(queueToInboxRows)]
                    .slice(0, 10)
                    .map((item, index) => (
                      <Link
                        key={`${item.kind}-${item.id}`}
                        href={item.href ?? "/inbox"}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3.5 items-center px-[18px] py-3 hover:bg-ink-2 transition-colors ${
                          index <
                          Math.min(10, inbox.length + emailQueues.length) - 1
                            ? "border-b border-ink-4"
                            : ""
                        }`}
                      >
                        <Pill tone={item.priority ?? "neutral"} dot>
                          {item.kind}
                        </Pill>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {item.subject}
                          </div>
                          <div className="text-[11.5px] text-text-3 truncate">
                            {item.from}
                            {item.project ? ` · ${item.project}` : ""}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-text-3 whitespace-nowrap">
                          {item.when}
                        </span>
                      </Link>
                    ))}
                </Panel>
              )}
            </section>
          </div>

          <div className="flex flex-col gap-3.5 self-start xl:sticky xl:top-[80px]">
            <Panel>
              <PanelHead
                title="Chat to Skippy"
                right={<MessageSquare size={15} className="text-status-ok" />}
              />
              <PanelBody className="grid gap-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChatMode("pickup")}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                      chatMode === "pickup"
                        ? "border-status-ok bg-status-ok/15 text-status-ok"
                        : "border-ink-4 bg-ink-2 text-text-2 hover:bg-ink-3"
                    }`}
                  >
                    Pick up a project
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode("ask")}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                      chatMode === "ask"
                        ? "border-status-ok bg-status-ok/15 text-status-ok"
                        : "border-ink-4 bg-ink-2 text-text-2 hover:bg-ink-3"
                    }`}
                  >
                    Ask Skippy
                  </button>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
                    Project context
                  </span>
                  <select
                    value={selectedProjectId}
                    onChange={(event) =>
                      setSelectedProjectId(event.target.value)
                    }
                    className="w-full rounded-md border border-ink-4 bg-ink-2 px-3 py-2 text-sm text-text-1 outline-none focus:border-status-ok"
                  >
                    {activeProjects.length === 0 ? (
                      <option value="">No active projects</option>
                    ) : (
                      activeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.clientName ? `${project.clientName} · ` : ""}
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={5}
                  placeholder={
                    chatMode === "pickup"
                      ? "Example: Pick up this project, check the latest blockers, and tell me the next useful move."
                      : "Example: What is the client waiting on, and what should I do next?"
                  }
                  className="w-full resize-none rounded-md border border-ink-4 bg-black/20 px-3 py-2 text-sm text-text-1 outline-none placeholder:text-text-3 focus:border-status-ok"
                />

                <button
                  type="button"
                  onClick={() => void sendSkippyIntake()}
                  disabled={!selectedProjectId}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-status-ok px-3 py-2 text-sm font-semibold text-background-card hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} /> Send to Skippy
                </button>

                {chatStatus ? (
                  <div
                    className={`rounded-[10px] border px-3 py-2 text-xs leading-5 ${
                      chatStatus.tone === "ok"
                        ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
                        : chatStatus.tone === "danger"
                          ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
                          : "border-status-warn/30 bg-status-warn/10 text-status-warn"
                    }`}
                  >
                    {chatStatus.message}
                  </div>
                ) : null}

                <div className="rounded-[12px] border border-ink-4 bg-black/10 p-3 text-[12px] leading-5 text-text-2">
                  Messages are logged to the project thread as an auditable
                  Skippy intake. For deep execution, open the project Skippy
                  tab.
                </div>

                {selectedProject ? (
                  <Link href={`/projects/${selectedProject.id}/command`}>
                    <Btn
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center"
                    >
                      Open project command centre <ArrowRight size={12} />
                    </Btn>
                  </Link>
                ) : null}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Skippy can do this"
                right={<Bot size={15} className="text-status-ok" />}
              />
              <PanelBody className="grid gap-3">
                {skippyCanDo.map((item) => (
                  <div
                    key={item}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5"
                  >
                    <Sparkles size={14} className="text-status-ok mt-0.5" />
                    <div className="text-[12.5px] text-text-2 leading-5">
                      {item}
                    </div>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Client lanes"
                right={<Users size={15} className="text-text-3" />}
              />
              <PanelBody className="grid gap-3.5">
                {topClientLanes.length === 0 ? (
                  <div className="text-[12.5px] text-text-3 text-center py-3">
                    No active client lanes.
                  </div>
                ) : (
                  topClientLanes.map((lane) => (
                    <div key={lane.client}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="text-[12.5px] font-semibold truncate">
                          {lane.client}
                        </div>
                        <div className="font-mono text-[11px] text-text-3 whitespace-nowrap">
                          {lane.projects.length} project
                          {lane.projects.length === 1 ? "" : "s"}
                          {lane.unread > 0 ? ` · ${lane.unread} unread` : ""}
                        </div>
                      </div>
                      <Bar
                        value={Math.min(
                          100,
                          lane.projects.length * 18 + lane.unread * 8
                        )}
                        tone={lane.unread > 0 ? "warn" : "ok"}
                      />
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Delivery capacity"
                right={<ShieldCheck size={15} className="text-text-3" />}
              />
              <PanelBody className="grid gap-3">
                {capacity.length === 0 ? (
                  <div className="text-[12.5px] text-text-3 text-center py-3">
                    Capacity feed not configured yet.
                  </div>
                ) : (
                  capacity.map((segment, index) => (
                    <div key={`${segment.label}-${index}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-text-2">
                          {segment.label}
                        </span>
                        <span className="font-mono text-[11.5px] text-text-3">
                          {segment.used} / {segment.alloc || "—"}h
                        </span>
                      </div>
                      <Bar
                        value={Math.min(
                          100,
                          (segment.used / Math.max(1, segment.alloc)) * 100
                        )}
                        tone={segment.tone ?? "ok"}
                      />
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Where this plugs in"
                right={<Building2 size={15} className="text-text-3" />}
              />
              <PanelBody className="grid gap-2.5 text-[12.5px] text-text-2 leading-5">
                <div>DeployOS is the delivery cockpit.</div>
                <div>Skippy is the auditable operator view inside it.</div>
                <div>
                  HubSpot and Gmail stay evidence sources; writes stay
                  approval-gated.
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ProjectRadarCard({ project }: { project: ProjectListItem }) {
  const tone = healthTone(project);
  const href = project.href ?? `/projects/${project.id}`;
  const progress = project.progress ?? 0;
  const used = project.hours?.used ?? 0;
  const allocated = project.hours?.allocated ?? 0;

  return (
    <Link
      href={href}
      className="block bg-ink-1 border border-ink-4 rounded-[16px] p-4 hover:border-ink-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold truncate">
            {project.name}
          </div>
          <div className="text-[12px] text-text-3 truncate mt-0.5">
            {project.clientName ?? "Unassigned client"}
          </div>
        </div>
        <Pill tone={tone} dot>
          {statusLabel(project.status)}
        </Pill>
      </div>
      <div className="text-[12.5px] text-text-2 min-h-[38px] leading-5">
        {project.nextAction ? (
          <>
            <span className="text-text-3">Next: </span>
            {project.nextAction}
          </>
        ) : (
          "No next action captured yet — prime candidate for Skippy to tighten up."
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10.5px] tracking-[0.1em] uppercase text-text-3 font-semibold">
            Progress
          </span>
          <span className="font-mono text-[11.5px] text-text-2">
            {progress}%
          </span>
        </div>
        <Bar value={progress} tone={tone} />
      </div>
      <div className="flex items-center justify-between mt-3 text-[11.5px] text-text-3">
        <span>
          {project.hubs && project.hubs.length > 0
            ? project.hubs.join(" + ")
            : "Delivery"}
        </span>
        <span className="font-mono">
          {allocated
            ? `${used}/${allocated}h`
            : `Updated ${relativeTime(project.updatedAt)}`}
        </span>
      </div>
    </Link>
  );
}

function RadarIcon({ reasonKey }: { reasonKey: string }) {
  const isBlocker = reasonKey === "overdue";
  return (
    <span
      className={`h-8 w-8 rounded-full flex items-center justify-center border ${
        isBlocker
          ? "bg-status-danger/10 border-status-danger/30 text-status-danger"
          : "bg-status-warn/10 border-status-warn/30 text-status-warn"
      }`}
    >
      {isBlocker ? <AlertTriangle size={15} /> : <Radar size={15} />}
    </span>
  );
}

function queueToInboxRows(queue: ClientEmailQueue): InboxItem[] {
  const emails = queue.emails ?? [];
  if (emails.length === 0 && queue.unreadCount > 0) {
    return [
      {
        id: queue.clientId,
        kind: "Gmail queue",
        subject: `${queue.unreadCount} unread client email${queue.unreadCount === 1 ? "" : "s"}`,
        from: queue.gmailLabel,
        project: queue.clientName,
        when: "needs triage",
        href: "/inbox",
        priority: "warn"
      }
    ];
  }

  return emails.slice(0, 2).map((email) => ({
    id: email.id,
    kind: email.unread ? "Email · unread" : "Email",
    subject: email.subject || "(no subject)",
    from: email.from || "—",
    project: queue.clientName,
    when: relativeTime(email.date),
    href: email.gmailUrl ?? "/inbox",
    priority: email.unread ? "warn" : "info"
  }));
}
