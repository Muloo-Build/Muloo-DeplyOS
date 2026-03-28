"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import AppShell from "./AppShell";

interface CountResponse {
  count: number;
}

interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  status: string;
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
    clientId?: string | null;
    hasClientSecret?: boolean;
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

interface CalendarEventItem {
  id: string;
  summary: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

interface CalendarStatusResponse {
  configured?: boolean;
  connected?: boolean;
  connectedEmail?: string | null;
  requiresReconnect?: boolean;
}

interface CalendarEventsResponse {
  connected?: boolean;
  connectedEmail?: string | null;
  events?: CalendarEventItem[];
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

interface DailySummaryResponse {
  content?: string | null;
  generatedBy?: string | null;
  createdAt?: string | null;
  error?: string;
}

interface IndustrySignalItem {
  title: string;
  link: string;
  source: string;
  category: string;
  summary: string;
  publishedAt: string | null;
}

interface IndustrySignalsResponse {
  items?: IndustrySignalItem[];
}

interface WorkspaceEmailDraftResponse {
  subject?: string;
  body?: string;
  error?: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: {
    transcript: string;
  };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
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

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatCalendarRange(event: CalendarEventItem) {
  if (event.start?.date && !event.start.dateTime) {
    return "All day";
  }

  if (!event.start?.dateTime) {
    return "Time to be confirmed";
  }

  const start = new Date(event.start.dateTime);
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    hour: "numeric",
    minute: "2-digit"
  });

  return end ? `${formatter.format(start)} - ${formatter.format(end)}` : formatter.format(start);
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

function extractLeadQuote(summary: string | null | undefined) {
  if (!summary?.trim()) {
    return null;
  }

  const candidate = summary
    .split("\n")
    .map((line) =>
      line
        .replace(/^#+\s*/, "")
        .replace(/^\-\s*/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .find((line) => line.length > 24);

  return candidate ? candidate.replace(/\s+/g, " ").slice(0, 180) : null;
}

function getFallbackQuote(name: string) {
  const quotes = [
    `Build with rhythm today, ${name}, not rush.`,
    `The sharpest momentum comes from one clean decision at a time.`,
    `Make the work feel inevitable by making the next step obvious.`,
    `Quiet execution compounds faster than noisy ambition.`
  ];

  return quotes[new Date().getDate() % quotes.length];
}

function resolveSpeechRecognition() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
  );
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

function SectionLabel(props: { label: string; title: string; body?: string }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
        {props.label}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{props.title}</h2>
      {props.body ? (
        <p className="mt-2 text-sm text-text-secondary">{props.body}</p>
      ) : null}
    </div>
  );
}

export default function MulooCommandCentre() {
  const [name, setName] = useState("team");
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [awaitingClientCount, setAwaitingClientCount] = useState(0);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [queuedRunsCount, setQueuedRunsCount] = useState(0);
  const [activeProjects, setActiveProjects] = useState<ProjectListItem[]>([]);
  const [recentRuns, setRecentRuns] = useState<ExecutionRun[]>([]);
  const [clientEmailQueues, setClientEmailQueues] = useState<ClientEmailQueue[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    null
  );
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarRequiresReconnect, setCalendarRequiresReconnect] =
    useState(false);
  const [calendarConnectedEmail, setCalendarConnectedEmail] = useState<
    string | null
  >(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
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
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null);
  const [refreshingBrief, setRefreshingBrief] = useState(false);
  const [industrySignals, setIndustrySignals] = useState<IndustrySignalItem[]>(
    []
  );
  const [emailNotes, setEmailNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [composerFeedback, setComposerFeedback] = useState<string | null>(null);
  const [draftingComposer, setDraftingComposer] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setVoiceSupported(Boolean(resolveSpeechRecognition()));
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    async function loadCommandCentre() {
      try {
        const [
          sessionResponse,
          activeProjectsCountResponse,
          awaitingClientCountResponse,
          overdueTasksCountResponse,
          queuedRunsCountResponse,
          activeProjectsResponse,
          recentRunsResponse,
          clientEmailQueuesResponse,
          gmailConnectionResponse,
          privateTasksResponse,
          calendarStatusResponse,
          calendarEventsResponse,
          latestSummaryResponse,
          industrySignalsResponse
        ] = await Promise.all([
          fetch("/api/auth/session", { credentials: "include" }),
          fetch("/api/projects?status=in-flight&count=true"),
          fetch("/api/projects?status=awaiting_client&count=true"),
          fetch("/api/tasks?overdue=true&count=true"),
          fetch("/api/execution-jobs?status=queued&count=true"),
          fetch("/api/projects?status=active&limit=4"),
          fetch("/api/execution-jobs?limit=4"),
          fetch("/api/workspace/emails/client-queues"),
          fetch("/api/email-oauth/google"),
          fetch("/api/workspace/private-tasks"),
          fetch("/api/workspace/calendar/status"),
          fetch("/api/workspace/calendar/events"),
          fetch("/api/workspace/summary/latest"),
          fetch("/api/workspace/industry-signals")
        ]);

        const sessionBody = (await sessionResponse.json().catch(() => null)) as
          | AuthSessionResponse
          | null;
        const sessionName = sessionBody?.user?.name?.trim();
        if (sessionName) {
          setName(sessionName.split(" ")[0] ?? sessionName);
        }

        const activeProjectsCountBody =
          (await activeProjectsCountResponse.json().catch(() => null)) as CountResponse | null;
        const awaitingClientCountBody =
          (await awaitingClientCountResponse.json().catch(() => null)) as CountResponse | null;
        const overdueTasksCountBody =
          (await overdueTasksCountResponse.json().catch(() => null)) as CountResponse | null;
        const queuedRunsCountBody =
          (await queuedRunsCountResponse.json().catch(() => null)) as CountResponse | null;
        const activeProjectsBody = (await activeProjectsResponse.json().catch(() => null)) as
          | { projects?: ProjectListItem[] }
          | null;
        const recentRunsBody = (await recentRunsResponse.json().catch(() => null)) as
          | { runs?: ExecutionRun[] }
          | null;
        const clientEmailQueuesBody = (
          await clientEmailQueuesResponse.json().catch(() => null)
        ) as
          | { queues?: ClientEmailQueue[] }
          | null;
        const gmailConnectionBody = (
          await gmailConnectionResponse.json().catch(() => null)
        ) as GmailConnectionResponse | null;
        const privateTasksBody = (
          await privateTasksResponse.json().catch(() => null)
        ) as PrivateTasksResponse | null;
        const calendarStatusBody = (
          await calendarStatusResponse.json().catch(() => null)
        ) as CalendarStatusResponse | null;
        const calendarEventsBody = (
          await calendarEventsResponse.json().catch(() => null)
        ) as CalendarEventsResponse | null;
        const latestSummaryBody = (
          await latestSummaryResponse.json().catch(() => null)
        ) as DailySummaryResponse | null;
        const industrySignalsBody = (
          await industrySignalsResponse.json().catch(() => null)
        ) as IndustrySignalsResponse | null;

        setActiveProjectsCount(activeProjectsCountBody?.count ?? 0);
        setAwaitingClientCount(awaitingClientCountBody?.count ?? 0);
        setOverdueTasksCount(overdueTasksCountBody?.count ?? 0);
        setQueuedRunsCount(queuedRunsCountBody?.count ?? 0);
        setActiveProjects(activeProjectsBody?.projects ?? []);
        setRecentRuns(recentRunsBody?.runs ?? []);
        setClientEmailQueues(clientEmailQueuesBody?.queues ?? []);
        setGmailConnected(gmailConnectionBody?.connection?.isConnected === true);
        setGmailConnectedEmail(gmailConnectionBody?.connection?.connectedEmail ?? null);
        setCalendarConnected(calendarStatusBody?.connected === true);
        setCalendarRequiresReconnect(calendarStatusBody?.requiresReconnect === true);
        setCalendarConnectedEmail(
          calendarStatusBody?.connectedEmail ??
            calendarEventsBody?.connectedEmail ??
            null
        );
        setCalendarEvents(calendarEventsBody?.events ?? []);
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
        setSummaryContent(latestSummaryBody?.content ?? null);
        setSummaryUpdatedAt(latestSummaryBody?.createdAt ?? null);
        setIndustrySignals(industrySignalsBody?.items ?? []);
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

  const leadQuote = useMemo(
    () => extractLeadQuote(summaryContent) ?? getFallbackQuote(name),
    [name, summaryContent]
  );

  const todayCalendarEvents = useMemo(() => {
    const now = new Date();
    const todaysEvents = calendarEvents.filter((event) => {
      const iso = event.start?.dateTime ?? event.start?.date;
      return iso ? isSameDay(new Date(iso), now) : false;
    });

    if (todaysEvents.length > 0) {
      return todaysEvents;
    }

    return calendarEvents.slice(0, 4);
  }, [calendarEvents]);

  const needsGoogleWorkspaceSetup =
    !calendarConnected || calendarRequiresReconnect || !gmailConnected;
  const googleSetupHref = needsGoogleWorkspaceSetup
    ? "/api/workspace/google/connect"
    : "/settings/workspace";

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
          title
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

  async function refreshMorningBrief() {
    setRefreshingBrief(true);

    try {
      const response = await fetch("/api/workspace/summary/generate", {
        method: "POST"
      });
      const body = (await response.json().catch(() => null)) as
        | DailySummaryResponse
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to refresh morning brief");
      }

      setSummaryContent(body?.content ?? null);
      setSummaryUpdatedAt(body?.createdAt ?? new Date().toISOString());
    } catch (error) {
      setComposerFeedback(
        error instanceof Error
          ? error.message
          : "Failed to refresh morning brief"
      );
    } finally {
      setRefreshingBrief(false);
    }
  }

  async function draftWorkspaceEmail() {
    if (!emailNotes.trim()) {
      setComposerFeedback("Add a short brief first so AI has something to shape.");
      return;
    }

    setDraftingComposer(true);
    setComposerFeedback(null);

    try {
      const response = await fetch("/api/workspace/email/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: emailNotes
        })
      });
      const body = (await response.json().catch(() => null)) as
        | WorkspaceEmailDraftResponse
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to draft email");
      }

      const subject = body?.subject?.trim() ?? "";
      const draftBody = body?.body?.trim() ?? "";
      setEmailDraft(
        [subject ? `Subject: ${subject}` : "", draftBody]
          .filter(Boolean)
          .join("\n\n")
      );
      setComposerFeedback("AI drafted the email. Tweak anything before sending.");
    } catch (error) {
      setComposerFeedback(
        error instanceof Error ? error.message : "Failed to draft email"
      );
    } finally {
      setDraftingComposer(false);
    }
  }

  async function copyDraft() {
    if (typeof navigator === "undefined" || !emailDraft.trim()) {
      return;
    }

    await navigator.clipboard.writeText(emailDraft);
    setComposerFeedback("Copied to clipboard.");
  }

  function toggleVoiceTyping() {
    const Recognition = resolveSpeechRecognition();

    if (!Recognition) {
      setComposerFeedback("Voice typing is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-ZA";
    recognition.onresult = (event) => {
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, offset) => event.results[event.resultIndex + offset]
      )
        .map((result) => result[0]?.transcript?.trim() ?? "")
        .filter(Boolean)
        .join(" ");

      if (!transcript) {
        return;
      }

      setEmailNotes((current) =>
        current.trim().length > 0
          ? `${current.trim()}\n${transcript}`
          : transcript
      );
    };
    recognition.onerror = () => {
      setComposerFeedback("Voice typing stopped unexpectedly. Try again.");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setComposerFeedback("Listening... speak naturally and it will drop into the email.");
    setIsListening(true);
    recognition.start();
  }

  return (
    <AppShell>
      <div className="brand-page min-h-screen overflow-x-hidden p-4 text-white sm:p-6 lg:p-8">
        <div className="space-y-8">
          <header className="brand-surface rounded-3xl border p-6 sm:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
                  Command Centre
                </p>
                <h1 className="mt-3 text-3xl font-semibold">{heading.greeting}</h1>
                <p className="mt-2 text-text-secondary">{heading.dateLabel}</p>
                <p className="mt-5 max-w-4xl text-lg font-medium leading-8 text-white/95 sm:text-xl">
                  {leadQuote}
                </p>
                {summaryUpdatedAt ? (
                  <p className="mt-3 text-sm text-text-muted">
                    Morning brief updated {formatRelativeTime(summaryUpdatedAt)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void refreshMorningBrief()}
                disabled={refreshingBrief}
                className="rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/55 disabled:opacity-60"
              >
                {refreshingBrief ? "Refreshing..." : "Refresh morning brief"}
              </button>
            </div>
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

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr_0.8fr]">
            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionLabel
                  label="Email"
                  title="Client Gmail watchlists"
                  body="Important labeled client mail, ready for quick triage or task creation."
                />
                <div className="text-right text-sm text-text-secondary">
                  <p>{gmailConnectedEmail ?? "Not connected"}</p>
                  <a
                    href={googleSetupHref}
                    className="mt-2 inline-flex text-brand-teal hover:text-white"
                  >
                    {needsGoogleWorkspaceSetup
                      ? "Finish Google setup"
                      : "Review Google setup"}
                  </a>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                {gmailConnected
                  ? "Add the exact Gmail label on the client record and keep your inbox filters feeding it. DeployOS shows unread first, then recent labeled mail."
                  : "Connect Google once and the Command Centre will use the same workspace auth for Gmail, Calendar, and Google Tasks."}
              </div>

              {emailFeedback ? (
                <div className="mt-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-white">
                  {emailFeedback}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading client email watchlists...
                  </div>
                ) : clientEmailQueues.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No client label queues are visible yet. Connect Gmail, add the label to the client, and let your mailbox rules keep feeding it.
                  </div>
                ) : (
                  clientEmailQueues.slice(0, 3).map((queue) => (
                    <div
                      key={queue.clientId}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-white">
                              {queue.clientName}
                            </p>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                              {queue.gmailLabel}
                            </span>
                            <span className="rounded-full border border-status-warning/35 bg-status-warning/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white">
                              {queue.unreadCount > 0
                                ? `${queue.unreadCount} unread in label`
                                : "last 5 emails"}
                            </span>
                          </div>
                        </div>
                        <Link
                          href="/clients"
                          className="text-sm text-text-secondary hover:text-brand-teal"
                        >
                          Manage labels →
                        </Link>
                      </div>

                      <div className="mt-4 space-y-3">
                        {queue.emails.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
                            The label is live, but Gmail is not returning any messages for it yet.
                          </div>
                        ) : (
                          queue.emails.slice(0, 5).map((email) => (
                            <div
                              key={email.id}
                              className="rounded-2xl border border-white/10 bg-[#0b1126] p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-white">
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
                                  onClick={() =>
                                    void createTaskFromEmail(queue, email)
                                  }
                                  disabled={creatingTodoEmailId === email.id}
                                  className="rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/55 disabled:opacity-60"
                                >
                                  {creatingTodoEmailId === email.id
                                    ? "Creating..."
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
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionLabel
                  label="Calendar"
                  title="Today in Google Calendar"
                  body="Your current-day view so the Command Centre opens around time, not just tasks."
                />
                <div className="text-right text-sm text-text-secondary">
                  <p>{calendarConnectedEmail ?? "Not connected"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                {calendarRequiresReconnect
                  ? "Reconnect Google once to keep calendar and Google Tasks in the same flow."
                  : calendarConnected
                    ? "Showing today first, then upcoming events if the day is still clear."
                    : "Finish the shared Google setup to bring in calendar and tasks."}
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading calendar...
                  </div>
                ) : !calendarConnected ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No calendar connection is active yet.
                  </div>
                ) : todayCalendarEvents.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No events are scheduled for today.
                  </div>
                ) : (
                  todayCalendarEvents.slice(0, 4).map((event) => (
                    <div
                      key={event.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        {event.summary}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {formatCalendarRange(event)}
                      </p>
                      {event.location ? (
                        <p className="mt-2 text-xs text-text-muted">
                          {event.location}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionLabel
                  label="Tasks"
                  title="Private Google Tasks"
                  body="A personal list that stays out of the PMO board."
                />
                <a
                  href={googleSetupHref}
                  className="text-sm text-text-secondary hover:text-brand-teal"
                >
                  Google setup →
                </a>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                {privateTasksRequiresReconnect
                  ? "Reconnect Google once to grant Google Tasks access."
                  : privateTasksConnected
                    ? `Synced with ${privateTaskListTitle}${privateTasksConnectedEmail ? ` as ${privateTasksConnectedEmail}` : ""}.`
                    : privateTasksConfigured
                      ? "Finish Google setup to sync your private task list."
                      : "Add Google Workspace credentials once, then connect the shared Google flow."}
              </div>

              {privateTaskFeedback ? (
                <div className="mt-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-white">
                  {privateTaskFeedback}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <input
                  type="text"
                  value={privateTaskTitle}
                  onChange={(event) => setPrivateTaskTitle(event.target.value)}
                  placeholder="Add a private task"
                  className="block min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
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
                  {savingPrivateTask ? "Adding..." : "Add"}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading private tasks...
                  </div>
                ) : privateTasks.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No private tasks yet. Add one here and it stays off the PMO board.
                  </div>
                ) : (
                  privateTasks.slice(0, 5).map((task) => (
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
                          <p className="mt-2 text-xs text-text-muted">
                            {task.completed
                              ? `Completed ${formatRelativeTime(
                                  task.completedAt ??
                                    task.updatedAt ??
                                    new Date().toISOString()
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
                          {deletingPrivateTaskId === task.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr_0.8fr]">
            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionLabel
                  label="Compose"
                  title="AI-assisted email composer"
                  body="Use the same plain-text drafting flow from the project workspace, now available in the Command Centre."
                />
              </div>

              {composerFeedback ? (
                <div className="mt-5 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-white">
                  {composerFeedback}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <textarea
                  value={emailNotes}
                  onChange={(event) => setEmailNotes(event.target.value)}
                  placeholder="Add context for the message you want to draft."
                  rows={9}
                  className="block w-full rounded-2xl border border-white/10 bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void draftWorkspaceEmail()}
                    disabled={draftingComposer}
                    className="rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/55 disabled:opacity-60"
                  >
                    {draftingComposer ? "Drafting..." : "Draft with AI"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoiceTyping}
                    disabled={!voiceSupported}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 disabled:opacity-60"
                  >
                    {isListening ? "Stop voice typing" : "Voice typing"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyDraft()}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 disabled:opacity-60"
                  >
                    Copy draft
                  </button>
                </div>
                <pre className="min-h-[220px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-text-secondary">
                  {emailDraft || "Generate a draft to see it here."}
                </pre>
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <SectionLabel
                  label="Projects"
                  title="Active projects"
                  body="The delivery work that moved most recently."
                />
                <Link href="/projects" className="text-sm text-text-secondary hover:text-brand-teal">
                  View all →
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading projects...
                  </div>
                ) : activeProjects.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No active projects are visible yet.
                  </div>
                ) : (
                  activeProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="brand-surface-soft flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:border-brand-teal/55"
                    >
                      <div>
                        <p className="font-medium text-white">{project.name}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {project.clientName}
                        </p>
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
                  ))
                )}
              </div>
            </div>

            <div className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <SectionLabel
                  label="Runs"
                  title="Recent automation"
                  body="The latest workflow and agent activity."
                />
                <Link href="/runs" className="text-sm text-text-secondary hover:text-brand-teal">
                  View all →
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    Loading runs...
                  </div>
                ) : recentRuns.length === 0 ? (
                  <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary">
                    No automation runs are visible yet.
                  </div>
                ) : (
                  recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href="/runs"
                      className="brand-surface-soft block rounded-2xl border p-4 transition hover:border-brand-teal/55"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{run.name}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                          {run.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        {run.projectName ?? "Workspace run"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${getStatusBadgeClass(
                            run.resultStatus ?? run.status
                          )}`}
                        >
                          {formatStatusLabel(run.resultStatus ?? run.status)}
                        </span>
                        <p className="text-xs text-text-muted">
                          {formatRelativeTime(run.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="brand-surface rounded-3xl border p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionLabel
                label="Daily Signal"
                title="Industry movement worth knowing"
                body="Fresh reading across AI improvements, marketing automation, SEO, HubSpot, and CRM platforms."
              />
              <p className="text-sm text-text-secondary">
                Updated from live external feeds
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary md:col-span-2 xl:col-span-4">
                  Loading daily industry signal...
                </div>
              ) : industrySignals.length === 0 ? (
                <div className="brand-surface-soft rounded-2xl border p-5 text-text-secondary md:col-span-2 xl:col-span-4">
                  No industry feed items are available right now.
                </div>
              ) : (
                industrySignals.map((item) => (
                  <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="brand-surface-soft rounded-2xl border p-4 transition hover:border-brand-teal/55"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                        {item.source}
                      </span>
                      <span className="rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-white">
                      {item.title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">
                      {item.summary || "Open the article to read the full update."}
                    </p>
                    <p className="mt-4 text-xs text-text-muted">
                      {item.publishedAt
                        ? formatRelativeTime(item.publishedAt)
                        : "Recently published"}
                    </p>
                  </a>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
