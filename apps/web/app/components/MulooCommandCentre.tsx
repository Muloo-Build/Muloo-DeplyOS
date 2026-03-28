"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface CountResponse {
  count: number;
}

interface NeedsAttentionItem {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  href: string;
  reason: string;
  reasonKey: "overdue" | "awaiting_client" | "blueprint_approved_no_delivery";
  age: string;
  status: string;
}

interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  status: string;
  defaultWorkspacePath?: string;
  updatedAt: string;
}

interface ExecutionRun {
  id: string;
  type: "workflow" | "agent";
  name: string;
  projectName: string | null;
  status: string;
  resultStatus: string | null;
  createdAt: string;
}

interface UsersResponse {
  users?: Array<{ name: string; email: string; isActive?: boolean }>;
}

interface AuthSessionResponse {
  authenticated?: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
}

interface GmailConnectionResponse {
  connection?: {
    isConnected?: boolean;
    connectedEmail?: string | null;
    gmailFilterLabel?: string | null;
  } | null;
}

interface ClientEmailItem {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  gmailUrl: string;
}

interface ClientEmailQueue {
  clientId: string;
  clientName: string;
  gmailLabel: string;
  unreadCount: number;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  }>;
  emails: ClientEmailItem[];
}

interface PrivateTaskItem {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  due?: string;
  completedAt?: string;
  updatedAt?: string;
}

interface PrivateTasksResponse {
  configured?: boolean;
  connected?: boolean;
  requiresReconnect?: boolean;
  connectedEmail?: string | null;
  taskListTitle?: string;
  tasks?: PrivateTaskItem[];
}

function formatDateHeading(date = new Date()) {
  return date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value.replace(/[_-]/g, " ");
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "complete":
      return "brand-status-success";
    case "queued":
    case "waiting_on_client":
    case "ready-for-execution":
      return "brand-status-warning";
    case "failed":
    case "blocked":
      return "brand-status-danger";
    default:
      return "brand-status-neutral";
  }
}

function getAttentionTone(reasonKey: NeedsAttentionItem["reasonKey"]) {
  switch (reasonKey) {
    case "overdue":
      return "border-status-error/35 bg-status-error/10 text-white";
    case "awaiting_client":
      return "border-status-warning/35 bg-status-warning/10 text-white";
    case "blueprint_approved_no_delivery":
      return "border-status-success/35 bg-status-success/10 text-white";
    default:
      return "brand-surface-soft text-white";
  }
}

function StatCard(props: {
  href: string;
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger";
}) {
  const toneClass =
    props.tone === "danger"
      ? "border-status-error/30 bg-status-error/10 text-white"
      : props.tone === "warning"
        ? "border-status-warning/30 bg-status-warning/10 text-white"
        : "border-brand-teal/25 bg-brand-teal/10 text-white";

  return (
    <Link
      href={props.href}
      className={`rounded-2xl border p-5 transition hover:border-brand-teal/60 ${toneClass}`}
    >
      <p className="text-sm text-text-secondary">{props.label}</p>
      <p className="mt-3 text-4xl font-semibold">{props.value}</p>
    </Link>
  );
}

export default function MulooCommandCentre() {
  const [name, setName] = useState("team");
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [awaitingClientCount, setAwaitingClientCount] = useState(0);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [queuedRunsCount, setQueuedRunsCount] = useState(0);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectListItem[]>([]);
  const [recentRuns, setRecentRuns] = useState<ExecutionRun[]>([]);
  const [clientEmailQueues, setClientEmailQueues] = useState<ClientEmailQueue[]>(
    []
  );
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    null
  );
  const [creatingTodoEmailId, setCreatingTodoEmailId] = useState<string | null>(
    null
  );
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [privateTasks, setPrivateTasks] = useState<PrivateTaskItem[]>([]);
  const [privateTasksConnected, setPrivateTasksConnected] = useState(false);
  const [privateTasksConfigured, setPrivateTasksConfigured] = useState(false);
  const [privateTasksRequiresReconnect, setPrivateTasksRequiresReconnect] =
    useState(false);
  const [privateTasksConnectedEmail, setPrivateTasksConnectedEmail] = useState<
    string | null
  >(null);
  const [privateTaskListTitle, setPrivateTaskListTitle] = useState(
    "Muloo DeployOS Private"
  );
  const [privateTaskTitle, setPrivateTaskTitle] = useState("");
  const [privateTaskNotes, setPrivateTaskNotes] = useState("");
  const [privateTaskFeedback, setPrivateTaskFeedback] = useState<string | null>(
    null
  );
  const [savingPrivateTask, setSavingPrivateTask] = useState(false);
  const [updatingPrivateTaskId, setUpdatingPrivateTaskId] = useState<
    string | null
  >(null);
  const [deletingPrivateTaskId, setDeletingPrivateTaskId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCommandCentre() {
      try {
        const [
          sessionResponse,
          activeProjectsCountResponse,
          awaitingClientCountResponse,
          overdueTasksCountResponse,
          queuedRunsCountResponse,
          needsAttentionResponse,
          activeProjectsResponse,
          recentRunsResponse,
          clientEmailQueuesResponse,
          gmailConnectionResponse,
          privateTasksResponse
        ] = await Promise.all([
          fetch("/api/auth/session", { credentials: "include" }),
          fetch("/api/projects?status=in-flight&count=true"),
          fetch("/api/projects?status=awaiting_client&count=true"),
          fetch("/api/tasks?overdue=true&count=true"),
          fetch("/api/execution-jobs?status=queued&count=true"),
          fetch("/api/projects/needs-attention"),
          fetch("/api/projects?status=active&limit=6"),
          fetch("/api/execution-jobs?limit=5"),
          fetch("/api/workspace/emails/client-queues"),
          fetch("/api/email-oauth/google"),
          fetch("/api/workspace/private-tasks")
        ]);

        const sessionBody = (await sessionResponse.json().catch(() => null)) as
          | AuthSessionResponse
          | null;
        const sessionName = sessionBody?.user?.name?.trim();
        if (sessionName) {
          setName(sessionName.split(" ")[0] ?? sessionName);
        } else {
          const usersFallbackResponse = await fetch("/api/users");
          const usersBody = (await usersFallbackResponse
            .json()
            .catch(() => null)) as UsersResponse | null;
          const firstActiveUser = usersBody?.users?.find(
            (user) => user.isActive !== false
          );
          if (firstActiveUser?.name?.trim()) {
            setName(firstActiveUser.name.split(" ")[0] ?? firstActiveUser.name);
          }
        }

        const activeProjectsCountBody =
          (await activeProjectsCountResponse.json().catch(() => null)) as CountResponse | null;
        const awaitingClientCountBody =
          (await awaitingClientCountResponse.json().catch(() => null)) as CountResponse | null;
        const overdueTasksCountBody =
          (await overdueTasksCountResponse.json().catch(() => null)) as CountResponse | null;
        const queuedRunsCountBody =
          (await queuedRunsCountResponse.json().catch(() => null)) as CountResponse | null;
        const needsAttentionBody = (await needsAttentionResponse.json().catch(() => null)) as
          | { items?: NeedsAttentionItem[] }
          | null;
        const activeProjectsBody = (await activeProjectsResponse.json().catch(() => null)) as
          | { projects?: ProjectListItem[] }
          | null;
        const recentRunsBody = (await recentRunsResponse.json().catch(() => null)) as
          | { runs?: ExecutionRun[] }
          | null;
        const clientEmailQueuesBody = (
          await clientEmailQueuesResponse.json().catch(() => null)
        ) as
          | { queues?: ClientEmailQueue[]; connected?: boolean }
          | null;
        const gmailConnectionBody = (
          await gmailConnectionResponse.json().catch(() => null)
        ) as GmailConnectionResponse | null;
        const privateTasksBody = (
          await privateTasksResponse.json().catch(() => null)
        ) as PrivateTasksResponse | null;

        setActiveProjectsCount(activeProjectsCountBody?.count ?? 0);
        setAwaitingClientCount(awaitingClientCountBody?.count ?? 0);
        setOverdueTasksCount(overdueTasksCountBody?.count ?? 0);
        setQueuedRunsCount(queuedRunsCountBody?.count ?? 0);
        setNeedsAttention(needsAttentionBody?.items ?? []);
        setActiveProjects(activeProjectsBody?.projects ?? []);
        setRecentRuns(recentRunsBody?.runs ?? []);
        setClientEmailQueues(clientEmailQueuesBody?.queues ?? []);
        setGmailConnected(gmailConnectionBody?.connection?.isConnected === true);
        setGmailConnectedEmail(gmailConnectionBody?.connection?.connectedEmail ?? null);
        setPrivateTasks(privateTasksBody?.tasks ?? []);
        setPrivateTasksConfigured(Boolean(privateTasksBody?.configured));
        setPrivateTasksConnected(privateTasksBody?.connected === true);
        setPrivateTasksRequiresReconnect(
          privateTasksBody?.requiresReconnect === true
        );
        setPrivateTasksConnectedEmail(privateTasksBody?.connectedEmail ?? null);
        setPrivateTaskListTitle(
          privateTasksBody?.taskListTitle?.trim() || "Muloo DeployOS Private"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCommandCentre();
  }, []);

  const heading = useMemo(() => {
    const now = new Date();
    return {
      greeting: `${getGreeting(now)}, ${name}.`,
      dateLabel: formatDateHeading(now)
    };
  }, [name]);

  async function loadPrivateTasks() {
    const response = await fetch("/api/workspace/private-tasks");
    const body = (await response.json().catch(() => null)) as
      | PrivateTasksResponse
      | null;

    if (!response.ok) {
      throw new Error("Failed to load private tasks");
    }

    setPrivateTasks(body?.tasks ?? []);
    setPrivateTasksConfigured(Boolean(body?.configured));
    setPrivateTasksConnected(body?.connected === true);
    setPrivateTasksRequiresReconnect(body?.requiresReconnect === true);
    setPrivateTasksConnectedEmail(body?.connectedEmail ?? null);
    setPrivateTaskListTitle(
      body?.taskListTitle?.trim() || "Muloo DeployOS Private"
    );
  }

  async function createTaskFromEmail(
    queue: ClientEmailQueue,
    email: ClientEmailItem
  ) {
    setCreatingTodoEmailId(email.id);
    setEmailFeedback(null);

    try {
      const primaryProject =
        queue.projects.length === 1 ? queue.projects[0] : undefined;
      const response = await fetch("/api/workspace/todos/from-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId: queue.clientId,
          clientName: queue.clientName,
          projectId: primaryProject?.id,
          projectName: primaryProject?.name,
          gmailLabel: queue.gmailLabel,
          emailId: email.id,
          emailSubject: email.subject,
          emailFrom: email.from,
          emailDate: email.date,
          gmailUrl: email.gmailUrl,
          snippet: email.snippet,
          notes:
            queue.projects.length > 1
              ? `Linked projects: ${queue.projects
                  .map((project) => project.name)
                  .join(", ")}`
              : ""
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create task from email");
      }

      setEmailFeedback(
        `Task created for ${queue.clientName}: ${body.title ?? email.subject}`
      );
    } catch (error) {
      setEmailFeedback(
        error instanceof Error
          ? error.message
          : "Failed to create task from email"
      );
    } finally {
      setCreatingTodoEmailId(null);
    }
  }

  async function createPrivateTask() {
    const title = privateTaskTitle.trim();
    const notes = privateTaskNotes.trim();

    if (!title) {
      setPrivateTaskFeedback("Give the private task a title first.");
      return;
    }

    setSavingPrivateTask(true);
    setPrivateTaskFeedback(null);

    try {
      const response = await fetch("/api/workspace/private-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          notes
        })
      });

      const body = (await response.json().catch(() => null)) as
        | PrivateTaskItem
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Failed to create private task"
        );
      }

      setPrivateTaskTitle("");
      setPrivateTaskNotes("");
      setPrivateTaskFeedback("Private task added to Google Tasks.");
      await loadPrivateTasks();
    } catch (error) {
      setPrivateTaskFeedback(
        error instanceof Error ? error.message : "Failed to create private task"
      );
    } finally {
      setSavingPrivateTask(false);
    }
  }

  async function togglePrivateTask(task: PrivateTaskItem) {
    setUpdatingPrivateTaskId(task.id);
    setPrivateTaskFeedback(null);

    try {
      const response = await fetch(`/api/workspace/private-tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          completed: !task.completed
        })
      });

      const body = (await response.json().catch(() => null)) as
        | PrivateTaskItem
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Failed to update private task"
        );
      }

      await loadPrivateTasks();
    } catch (error) {
      setPrivateTaskFeedback(
        error instanceof Error ? error.message : "Failed to update private task"
      );
    } finally {
      setUpdatingPrivateTaskId(null);
    }
  }

  async function removePrivateTask(taskId: string) {
    setDeletingPrivateTaskId(taskId);
    setPrivateTaskFeedback(null);

    try {
      const response = await fetch(`/api/workspace/private-tasks/${taskId}`, {
        method: "DELETE"
      });

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Failed to delete private task"
        );
      }

      await loadPrivateTasks();
    } catch (error) {
      setPrivateTaskFeedback(
        error instanceof Error ? error.message : "Failed to delete private task"
      );
    } finally {
      setDeletingPrivateTaskId(null);
    }
  }

  return (
    <AppShell>
      <div className="brand-page min-h-screen p-4 text-white sm:p-6 lg:p-8">
        <div className="space-y-8">
          <header className="brand-surface rounded-3xl border p-6 sm:p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Command Centre
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{heading.greeting}</h1>
            <p className="mt-2 text-text-secondary">{heading.dateLabel}</p>
          </header>

          <section className="grid gap-4 xl:grid-cols-4">
            <StatCard
              href="/projects?status=in-flight"
              label="Active projects"
              value={activeProjectsCount}
              tone="neutral"
            />
            <StatCard
              href="/projects?status=awaiting_client"
              label="Awaiting client"
              value={awaitingClientCount}
              tone="warning"
            />
            <StatCard
              href="/projects?status=attention"
              label="Overdue tasks"
              value={overdueTasksCount}
              tone="danger"
            />
            <StatCard
              href="/runs?status=queued"
              label="Runs queued"
              value={queuedRunsCount}
              tone="warning"
            />
          </section>

          <section className="brand-surface rounded-3xl border p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Client email watchlists
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Unread Gmail labels for active clients
                </h2>
                <p className="mt-2 text-text-secondary">
                  Surface the client labels you maintain in Gmail, spot unread
                  mail quickly, and turn an email into a task without leaving
                  DeployOS.
                </p>
                <p className="mt-3 text-sm text-text-secondary">
                  How it works: connect Gmail in Settings, add the matching
                  Gmail label to each client record, and keep your Gmail filters
                  moving mail into those labels. DeployOS will only surface
                  unread mail from those client queues here.
                </p>
              </div>
              <Link
                href="/clients"
                className="text-sm text-text-secondary hover:text-brand-teal"
              >
                Manage client labels →
              </Link>
            </div>

            {emailFeedback ? (
              <div className="mt-5 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-white">
                {emailFeedback}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {loading ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                  Loading client email watchlists...
                </div>
              ) : clientEmailQueues.length === 0 ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                  {!gmailConnected
                    ? "Connect Gmail in Settings first, then add a Gmail label to a client record and let your mailbox filters move that client mail into the label."
                    : "No unread client-labeled Gmail queues are visible yet. Add a Gmail label to a client record and keep using your mailbox filters to feed it."}
                  {gmailConnectedEmail
                    ? ` Connected as ${gmailConnectedEmail}.`
                    : ""}
                </div>
              ) : (
                clientEmailQueues.map((queue) => (
                  <div
                    key={queue.clientId}
                    className="brand-surface-soft rounded-3xl border p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-white">
                            {queue.clientName}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                            {queue.gmailLabel}
                          </span>
                          <span className="rounded-full border border-status-warning/35 bg-status-warning/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white">
                            {queue.unreadCount} unread
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {queue.projects.length > 0 ? (
                            queue.projects.map((project) => (
                              <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary transition hover:border-brand-teal/50 hover:text-white"
                              >
                                {project.name}
                              </Link>
                            ))
                          ) : (
                            <span className="text-xs text-text-muted">
                              No linked project yet
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {queue.emails.map((email) => (
                        <div
                          key={email.id}
                          className="rounded-2xl border border-white/10 bg-[#0b1126] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-medium text-white">
                                {email.subject}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {email.from}
                              </p>
                            </div>
                            <p className="text-xs text-text-muted">
                              {formatRelativeTime(email.date)}
                            </p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-text-secondary">
                            {email.snippet || "No preview available yet."}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void createTaskFromEmail(queue, email)}
                              disabled={creatingTodoEmailId === email.id}
                              className="rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/55 disabled:opacity-60"
                            >
                              {creatingTodoEmailId === email.id
                                ? "Creating task..."
                                : "Create task"}
                            </button>
                            <a
                              href={email.gmailUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20"
                            >
                              Open in Gmail
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="brand-surface rounded-3xl border p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Needs Attention
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  The next five things to unblock
                </h2>
              </div>
              <Link href="/projects" className="text-sm text-text-secondary hover:text-brand-teal">
                View all projects →
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                  Loading attention queue...
                </div>
              ) : needsAttention.length === 0 ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                  Nothing urgent is flagged right now.
                </div>
              ) : (
                needsAttention.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`block rounded-2xl border p-4 transition hover:border-brand-teal/55 ${getAttentionTone(
                      item.reasonKey
                    )}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {item.projectName}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {item.clientName} · {item.reason}
                        </p>
                      </div>
                      <div className="text-right text-sm text-text-secondary">
                        <p>{item.age}</p>
                        <p className="brand-surface-soft mt-1 inline-flex rounded-full border px-2 py-1 text-xs uppercase tracking-[0.18em] text-white">
                          {formatStatusLabel(item.reasonKey)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Active Projects
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Recently updated delivery work
                  </h2>
                </div>
                <Link href="/projects" className="text-sm text-text-secondary hover:text-brand-teal">
                  View all projects →
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {activeProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="brand-surface-soft flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:border-brand-teal/55"
                  >
                    <div>
                      <p className="font-medium text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-text-secondary">{project.clientName}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${getStatusBadgeClass(
                          project.status
                        )}`}
                      >
                        {formatStatusLabel(project.status)}
                      </span>
                      <p className="mt-2 text-xs text-text-muted">
                        {formatRelativeTime(project.updatedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Recent Runs
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Latest automation activity
                  </h2>
                </div>
                <Link href="/runs" className="text-sm text-text-secondary hover:text-brand-teal">
                  View all runs →
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    href="/runs"
                    className="brand-surface-soft flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:border-brand-teal/55"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{run.name}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                          {run.type}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {run.projectName ?? "Workspace run"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${getStatusBadgeClass(
                          run.status
                        )}`}
                      >
                        {formatStatusLabel(run.status)}
                      </span>
                      <p className="mt-2 text-xs text-text-muted">
                        {formatRelativeTime(run.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Private Tasks
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Personal Google Tasks
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    Keep a private to-do list for your own follow-ups, separate
                    from the PMO board.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="text-sm text-text-secondary hover:text-brand-teal"
                >
                  Google setup →
                </Link>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                {privateTasksRequiresReconnect
                  ? "Reconnect Google Calendar in Settings to grant Google Tasks access for your private list."
                  : privateTasksConnected
                    ? `Synced with ${privateTaskListTitle} in Google Tasks${privateTasksConnectedEmail ? ` as ${privateTasksConnectedEmail}` : ""}.`
                    : privateTasksConfigured
                      ? "Connect your Google workspace in Settings to sync a private task list."
                      : "Add Google OAuth credentials in Settings, then connect your Google account to use private tasks."}
              </div>

              {privateTaskFeedback ? (
                <div className="mt-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-white">
                  {privateTaskFeedback}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={privateTaskTitle}
                  onChange={(event) => setPrivateTaskTitle(event.target.value)}
                  placeholder="Add a private task"
                  className="block w-full rounded-2xl border border-white/10 bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
                />
                <textarea
                  value={privateTaskNotes}
                  onChange={(event) => setPrivateTaskNotes(event.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                  className="block w-full rounded-2xl border border-white/10 bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => void createPrivateTask()}
                  disabled={
                    savingPrivateTask ||
                    !privateTasksConnected ||
                    privateTasksRequiresReconnect
                  }
                  className="rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/55 disabled:opacity-60"
                >
                  {savingPrivateTask ? "Adding..." : "Add private task"}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading private tasks...
                  </div>
                ) : privateTasks.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No private tasks yet. Add one here and it will stay out of
                    the PMO board.
                  </div>
                ) : (
                  privateTasks.map((task) => (
                    <div
                      key={task.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void togglePrivateTask(task)}
                          disabled={updatingPrivateTaskId === task.id}
                          className={`mt-0.5 h-5 w-5 rounded-full border transition ${
                            task.completed
                              ? "border-brand-teal bg-brand-teal"
                              : "border-white/20 bg-transparent"
                          }`}
                          aria-label={
                            task.completed
                              ? "Mark task as incomplete"
                              : "Mark task as complete"
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              task.completed
                                ? "text-text-muted line-through"
                                : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.notes ? (
                            <p className="mt-1 text-sm text-text-secondary">
                              {task.notes}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-text-muted">
                            {task.completed
                              ? `Completed ${formatRelativeTime(
                                  task.completedAt ?? task.updatedAt ?? new Date().toISOString()
                                )}`
                              : `Updated ${formatRelativeTime(
                                  task.updatedAt ?? new Date().toISOString()
                                )}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removePrivateTask(task.id)}
                          disabled={deletingPrivateTaskId === task.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-white/20 hover:text-white disabled:opacity-60"
                        >
                          {deletingPrivateTaskId === task.id
                            ? "Removing..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
