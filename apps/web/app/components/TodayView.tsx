"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronRight,
  ExternalLink,
  Flag,
  Inbox as InboxIcon,
  Info,
  Plus,
  RefreshCw
} from "lucide-react";

import AppShell from "./AppShell";
import { Bar } from "./ui/Bar";
import { Btn } from "./ui/Btn";
import { Decision } from "./ui/Decision";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { SectionHead } from "./ui/SectionHead";
import { Seg } from "./ui/Tabs";
import { Avatar } from "./ui/Avatar";

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

interface ProjectListItem {
  id: string;
  name: string;
  clientName: string | null;
  clientSlug?: string | null;
  status: string;
  stage?: string | null;
  hubs?: string[];
  progress?: number;
  hours?: { used?: number; allocated?: number; period?: string };
  nextAction?: string;
  health?: "ok" | "warn" | "danger";
  href?: string;
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

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
}

interface CapacitySegment {
  label: string;
  used: number;
  alloc: number;
  tone?: "ok" | "warn" | "danger";
}

const decisionFilters = [
  { id: "all", label: "All" },
  { id: "blockers", label: "Blockers" },
  { id: "scope", label: "Scope" }
];

function formatToday(): string {
  const date = new Date();
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function decisionSeverity(reasonKey: string): "danger" | "warn" | "info" {
  if (reasonKey === "overdue") return "danger";
  if (reasonKey === "awaiting_client") return "warn";
  return "info";
}

function decisionIcon(reasonKey: string) {
  if (reasonKey === "overdue") return <AlertTriangle size={16} />;
  if (reasonKey === "awaiting_client") return <Flag size={16} />;
  return <Info size={16} />;
}

function decisionKindLabel(reasonKey: string): string {
  switch (reasonKey) {
    case "overdue":
      return "Blocker";
    case "awaiting_client":
      return "Scope";
    case "blueprint_approved_no_delivery":
      return "Action";
    default:
      return "Decision";
  }
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(iso?: string, allDay?: string): string {
  if (allDay) return "All day";
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function TodayView() {
  const [name, setName] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<NeedsAttentionItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [capacity, setCapacity] = useState<CapacitySegment[]>([]);
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [me, attn, projRes, inboxRes, calRes, capRes, gmailRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/projects/needs-attention")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/projects")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/inbox").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/workspace/calendar/events")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/capacity")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/workspace/emails/client-queues")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const userName: string | undefined = me?.user?.name ?? me?.name;
      if (userName) setName(userName.split(" ")[0] ?? userName);

      setDecisions(Array.isArray(attn?.items) ? attn.items.slice(0, 5) : []);

      const projItems: ProjectListItem[] = Array.isArray(projRes?.projects)
        ? projRes.projects
        : Array.isArray(projRes?.items)
          ? projRes.items
          : Array.isArray(projRes)
            ? projRes
            : [];
      // Real Project enum: draft / scoping / designed / ready-for-execution
      // / in-flight / completed / archived. "In flight" = anything still
      // active (not completed / archived) — that's what Today should show.
      const activeStatuses = new Set([
        "draft",
        "scoping",
        "designed",
        "ready-for-execution",
        "in-flight"
      ]);
      const inFlight = projItems
        .filter((p) => !p.status || activeStatuses.has(p.status))
        .slice(0, 4);
      setProjects(inFlight);

      // Build the recent inbox stream from project messages + submissions
      // (internal) + Gmail unread (external) so it matches what the design
      // brief calls "recent inbox": one row per real signal with sender,
      // subject, project/client and a kind pill.
      const internalRows: InboxItem[] = (() => {
        if (!inboxRes) return [];
        const messages = Array.isArray(inboxRes?.messages)
          ? (inboxRes.messages as Array<Record<string, unknown>>)
          : [];
        const submissions = Array.isArray(inboxRes?.submissionAlerts)
          ? (inboxRes.submissionAlerts as Array<Record<string, unknown>>)
          : [];

        const messageRows: InboxItem[] = messages.map((row) => {
          const body = String(row.body ?? "").trim();
          const subjectFromBody =
            body.length > 0
              ? body.length > 80
                ? `${body.slice(0, 80)}…`
                : body
              : "Project message";
          const project =
            row.project && typeof row.project === "object"
              ? String((row.project as Record<string, unknown>).name ?? "")
              : "";
          const senderType = String(row.senderType ?? "");
          return {
            id: `msg_${String(row.id ?? Math.random())}`,
            kind: senderType === "client" ? "Client message" : "Internal note",
            subject: subjectFromBody,
            from: String(row.senderName ?? "—"),
            project: project || null,
            when: relativeTime((row.createdAt as string | undefined) ?? undefined),
            href: project ? `/projects/${row.projectId}` : "/inbox",
            priority:
              senderType === "client" ? ("warn" as const) : ("info" as const)
          };
        });

        const submissionRows: InboxItem[] = submissions.map((row) => {
          const proj = (row.project ?? {}) as Record<string, unknown>;
          const session = row.sessionNumber ? `section ${row.sessionNumber}` : "their inputs";
          return {
            id: `sub_${String(proj.id ?? Math.random())}`,
            kind: "Submission",
            subject: `${row.submittedByName ?? "Client"} updated ${session}`,
            from: String(row.submittedByName ?? "Client"),
            project: proj.name ? String(proj.name) : null,
            when: relativeTime((row.updatedAt as string | undefined) ?? undefined),
            href: proj.id ? `/projects/${String(proj.id)}/inputs` : "/inbox",
            priority: "info" as const
          };
        });

        return [...messageRows, ...submissionRows];
      })();

      const gmailRows: InboxItem[] = (() => {
        if (!gmailRes?.connected) return [];
        const queues = Array.isArray(gmailRes.queues)
          ? (gmailRes.queues as Array<Record<string, unknown>>)
          : [];
        const flat: InboxItem[] = [];
        for (const queue of queues) {
          const clientName = String(queue.clientName ?? "—");
          const emails = Array.isArray(queue.emails)
            ? (queue.emails as Array<Record<string, unknown>>)
            : [];
          for (const email of emails.slice(0, 3)) {
            const subject = String(email.subject ?? "(no subject)").trim();
            const from = String(email.from ?? "—");
            const isUnread = email.unread === true;
            flat.push({
              id: `gmail_${String(email.id ?? Math.random())}`,
              kind: isUnread ? "Email · unread" : "Email",
              subject: subject.length > 80 ? `${subject.slice(0, 80)}…` : subject,
              from: from.replace(/<[^>]+>/, "").trim() || from,
              project: clientName,
              when: relativeTime((email.date as string | undefined) ?? undefined),
              href:
                typeof email.gmailUrl === "string"
                  ? (email.gmailUrl as string)
                  : "/inbox",
              priority: isUnread ? ("warn" as const) : ("info" as const)
            });
          }
        }
        return flat;
      })();

      const merged = [...internalRows, ...gmailRows]
        .sort((a, b) => {
          // Recency rank using the relative-time ordering
          const order = ["just now", "m ago", "h ago", "d ago"];
          const rankOf = (t: string) =>
            order.findIndex((suffix) => t.endsWith(suffix) || t === suffix);
          const rA = rankOf(a.when);
          const rB = rankOf(b.when);
          if (rA !== rB) return rA - rB;
          return 0;
        })
        .slice(0, 5);

      setInbox(merged);

      if (calRes?.connected && Array.isArray(calRes.events)) {
        const todayEvents = (calRes.events as CalendarEvent[]).filter((e) =>
          isToday(e.start?.dateTime ?? e.start?.date)
        );
        setCalendarEvents(todayEvents.slice(0, 6));
      } else {
        setCalendarEvents([]);
      }

      if (Array.isArray(capRes?.segments)) {
        setCapacity(
          (capRes.segments as Array<{
            label: string;
            used: number;
            alloc: number;
            tone?: "ok" | "warn" | "danger";
          }>).slice(0, 5)
        );
      } else if (Array.isArray(capRes?.buckets)) {
        setCapacity(
          (capRes.buckets as Array<{
            label: string;
            used: number;
            allocated: number;
          }>).map((b) => ({
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
    void loadAll();
  }, []);

  const decisionsFiltered = useMemo(() => {
    if (decisionFilter === "all") return decisions;
    if (decisionFilter === "blockers") {
      return decisions.filter((d) => d.reasonKey === "overdue");
    }
    if (decisionFilter === "scope") {
      return decisions.filter(
        (d) =>
          d.reasonKey === "awaiting_client" ||
          d.reasonKey === "blueprint_approved_no_delivery"
      );
    }
    return decisions;
  }, [decisions, decisionFilter]);

  const blockerCount = decisions.filter((d) => d.reasonKey === "overdue").length;
  const scopeCount = decisions.filter(
    (d) => d.reasonKey === "awaiting_client" || d.reasonKey === "blueprint_approved_no_delivery"
  ).length;

  const decisionsLeadCount = decisions.length;
  const calendarLeadCount = calendarEvents.length;
  const lede = useMemo(() => {
    const parts: string[] = [];
    if (decisionsLeadCount > 0) {
      parts.push(
        `${decisionsLeadCount} ${decisionsLeadCount === 1 ? "thing needs" : "things need"} a decision from you`
      );
    }
    if (calendarLeadCount > 0) {
      parts.push(
        `${calendarLeadCount} ${calendarLeadCount === 1 ? "meeting" : "meetings"} on the calendar`
      );
    }
    if (parts.length === 0) {
      return "Quiet day. Use this time to push delivery forward.";
    }
    return parts.join(". ") + ".";
  }, [decisionsLeadCount, calendarLeadCount]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow={`Today · ${formatToday()}`}
          title={
            name ? `${getGreeting()}, ${name}.` : `${getGreeting()}.`
          }
          lede={lede}
          actions={
            <>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => void loadAll()}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Refresh brief
              </Btn>
              <Link href="/projects/new">
                <Btn variant="primary" size="md">
                  <Plus size={14} />
                  New project
                </Btn>
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Decisions */}
            <section>
              <SectionHead
                title="Needs a decision"
                right={
                  <Seg
                    options={decisionFilters.map((f) => ({
                      id: f.id,
                      label: (
                        <span>
                          {f.label}{" "}
                          <span className="font-mono text-text-4 ml-0.5">
                            {f.id === "all"
                              ? decisions.length
                              : f.id === "blockers"
                                ? blockerCount
                                : scopeCount}
                          </span>
                        </span>
                      )
                    }))}
                    active={decisionFilter}
                    onChange={setDecisionFilter}
                  />
                }
              />
              {decisionsFiltered.length === 0 ? (
                <Empty
                  icon={<Info size={20} />}
                  title="Nothing flagged"
                  sub="No projects need a decision right now."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {decisionsFiltered.map((d) => (
                    <Link key={d.id} href={d.href} className="contents">
                      <Decision
                        icon={decisionIcon(d.reasonKey)}
                        severity={decisionSeverity(d.reasonKey)}
                        title={d.reason}
                        sub={d.projectName}
                        ctx={[
                          <span key="kind">
                            <span className="inline-flex items-center font-mono text-[10.5px] tracking-[0.04em] uppercase px-1.5 py-0.5 bg-ink-3 border border-ink-4 rounded text-text-2">
                              {decisionKindLabel(d.reasonKey)}
                            </span>
                          </span>,
                          d.clientName ? `· ${d.clientName}` : null,
                          d.age ? `· ${d.age}` : null
                        ].filter(Boolean) as React.ReactNode[]}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Projects in flight */}
            <section>
              <SectionHead
                title="Projects in flight"
                right={
                  <Link href="/projects">
                    <Btn variant="ghost" size="sm">
                      View all <ArrowRight size={12} />
                    </Btn>
                  </Link>
                }
              />
              {projects.length === 0 ? (
                <Empty
                  icon={<InboxIcon size={20} />}
                  title="No active projects"
                  sub="Spin one up from a quote or template."
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {projects.map((p) => (
                    <ProjectRow key={p.id} project={p} />
                  ))}
                </div>
              )}
            </section>

            {/* Recent inbox */}
            <section>
              <SectionHead
                title="Recent inbox"
                right={
                  <Link href="/inbox">
                    <Btn variant="ghost" size="sm">
                      Open inbox <ArrowRight size={12} />
                    </Btn>
                  </Link>
                }
              />
              {inbox.length === 0 ? (
                <Panel>
                  <PanelBody>
                    <Empty
                      icon={<InboxIcon size={20} />}
                      title="Inbox is clear"
                      sub="No new client messages or work requests."
                    />
                  </PanelBody>
                </Panel>
              ) : (
                <Panel>
                  {inbox.map((m, i) => (
                    <Link
                      key={m.id}
                      href={m.href ?? "/inbox"}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-3.5 items-center px-[18px] py-3 cursor-pointer hover:bg-ink-2 transition-colors ${
                        i < inbox.length - 1 ? "border-b border-ink-4" : ""
                      }`}
                    >
                      <Pill tone={m.priority ?? "neutral"} dot>
                        {m.kind}
                      </Pill>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          {m.subject}
                        </div>
                        <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                          {m.from}
                          {m.project ? ` · ${m.project}` : ""}
                        </div>
                      </div>
                      <span className="text-text-3 font-mono text-[11px] whitespace-nowrap">
                        {m.when}
                      </span>
                      <ChevronRight size={14} className="text-text-3" />
                    </Link>
                  ))}
                </Panel>
              )}
            </section>
          </div>

          {/* RIGHT RAIL */}
          <div className="flex flex-col gap-3.5 self-start xl:sticky xl:top-[80px]">
            <Panel>
              <PanelHead
                title="Today's calendar"
                right={
                  <Link href="/calendar">
                    <Btn variant="ghost" size="icon" aria-label="Open calendar">
                      <ExternalLink size={13} />
                    </Btn>
                  </Link>
                }
              />
              <PanelBody>
                {calendarEvents.length === 0 ? (
                  <div className="text-text-3 text-[12.5px] py-4 text-center">
                    No meetings today.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {calendarEvents.map((e, i) => (
                      <div
                        key={e.id}
                        className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 ${
                          i < calendarEvents.length - 1
                            ? "pb-3.5 border-b border-ink-4"
                            : ""
                        }`}
                      >
                        <div className="font-mono text-[11.5px] text-status-ok font-semibold min-w-[80px]">
                          {formatTime(e.start?.dateTime, e.start?.date)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium truncate">
                            {e.summary}
                          </div>
                          {e.attendees && e.attendees.length > 0 && (
                            <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                              {e.attendees
                                .slice(0, 3)
                                .map((a) => a.displayName ?? a.email)
                                .join(", ")}
                              {e.attendees.length > 3 ? ` +${e.attendees.length - 3}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead title="This week" />
              <PanelBody className="grid gap-3.5">
                <RailStat
                  label="Active projects"
                  value={String(projects.length)}
                  delta={
                    projects.length > 0
                      ? `${projects.filter((p) => p.health === "warn").length} flagged`
                      : "—"
                  }
                />
                <RailStat
                  label="Decisions pending"
                  value={String(decisions.length)}
                  delta={blockerCount > 0 ? `${blockerCount} blockers` : "all clear"}
                  tone={blockerCount > 0 ? "danger" : "neutral"}
                />
                <RailStat
                  label="Inbox"
                  value={String(inbox.length)}
                  delta={inbox.length > 0 ? "needs review" : "clear"}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead
                title="Capacity"
                right={
                  <span className="font-mono text-[10.5px] tracking-[0.04em] uppercase px-1.5 py-0.5 bg-ink-3 border border-ink-4 rounded text-text-2">
                    This week
                  </span>
                }
              />
              <PanelBody className="grid gap-3">
                {capacity.length === 0 ? (
                  <div className="text-text-3 text-[12.5px] py-1 text-center">
                    Capacity feed not configured.
                  </div>
                ) : (
                  capacity.map((c, i) => (
                    <CapacityRow
                      key={`${c.label}-${i}`}
                      label={c.label}
                      used={c.used}
                      alloc={c.alloc}
                      tone={c.tone}
                    />
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ProjectRow({ project }: { project: ProjectListItem }) {
  const stage = project.stage ?? statusLabel(project.status);
  const tone =
    project.health === "danger"
      ? "danger"
      : project.health === "warn"
        ? "warn"
        : "ok";
  const progress = project.progress ?? 0;
  const used = project.hours?.used ?? 0;
  const alloc = project.hours?.allocated ?? 0;
  const period = project.hours?.period ?? "this month";
  const href = project.href ?? `/projects/${project.id}`;

  return (
    <Link
      href={href}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-4 items-center px-[18px] py-3.5 bg-ink-1 border border-ink-4 rounded-[14px] hover:border-ink-5 transition-colors"
    >
      <Avatar size="lg" initials={(project.clientName ?? project.name).slice(0, 2)} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-semibold truncate">{project.name}</span>
          <Pill tone={tone} dot>
            {stage}
          </Pill>
        </div>
        <div className="text-[12px] text-text-3 truncate">
          {project.clientName ?? "—"}
          {project.hubs && project.hubs.length > 0 ? ` · ${project.hubs.join(" + ")}` : ""}
          {project.nextAction && (
            <>
              {" "}
              · Next:{" "}
              <span className="text-text-2">{project.nextAction}</span>
            </>
          )}
        </div>
      </div>
      <div className="min-w-[140px] hidden lg:block">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10.5px] tracking-[0.1em] uppercase text-text-3 font-semibold">
            Progress
          </span>
          <span className="font-mono text-[11.5px] text-text-2">{progress}%</span>
        </div>
        <Bar value={progress} tone={tone === "ok" ? "ok" : tone === "warn" ? "warn" : "danger"} />
      </div>
      <div className="min-w-[80px] text-right hidden md:block">
        <div className="font-mono text-[13px] font-semibold">
          {used}/{alloc || "—"}
          {alloc ? "h" : ""}
        </div>
        <div className="text-[11px] text-text-3">{period}</div>
      </div>
      <ChevronRight size={14} className="text-text-3" />
    </Link>
  );
}

function statusLabel(status?: string): string {
  if (!status) return "Active";
  const map: Record<string, string> = {
    draft: "Draft",
    scoping: "Scoping",
    designed: "Designed",
    "ready-for-execution": "Ready for execution",
    "in-flight": "In flight",
    in_delivery: "In delivery",
    awaiting_approval: "Awaiting approval",
    blocked_external: "Blocked",
    live: "Live",
    completed: "Completed",
    archived: "Archived"
  };
  return map[status] ?? status.replace(/_/g, " ").replace(/-/g, " ");
}

function RailStat({
  label,
  value,
  delta,
  tone = "neutral"
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "danger" | "warn" | "ok";
}) {
  const valueColor =
    tone === "danger"
      ? "text-status-danger"
      : tone === "warn"
        ? "text-status-warn"
        : tone === "ok"
          ? "text-status-ok"
          : "text-text-1";
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.12em] uppercase text-text-3 font-semibold mb-1">
        {label}
      </div>
      <div className={`text-[22px] font-semibold -tracking-[0.01em] tnum ${valueColor}`}>
        {value}
      </div>
      {delta && <div className="text-[11.5px] text-text-3">{delta}</div>}
    </div>
  );
}

function CapacityRow({
  label,
  used,
  alloc,
  tone
}: {
  label: string;
  used: number;
  alloc: number;
  tone?: "ok" | "warn" | "danger";
}) {
  const safeAlloc = alloc > 0 ? alloc : 1;
  const pct = Math.min(100, (used / safeAlloc) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-text-2">{label}</span>
        <span className="font-mono text-[11.5px] text-text-3">
          {used} / {alloc || "—"}h
        </span>
      </div>
      <Bar value={pct} tone={tone ?? "ok"} />
    </div>
  );
}
