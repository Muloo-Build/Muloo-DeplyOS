"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "./AppShell";

interface Todo {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  gmailUrl: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  hangoutLink?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
}

interface Invoice {
  invoiceNumber: string;
  contact: string;
  dueDate: string;
  amountDue: number;
  status: string;
  isOverdue: boolean;
}

interface XeroSummary {
  totalOutstanding: number;
  totalOverdue: number;
  currency: string;
  invoices: Invoice[];
}

interface Quote {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  version: number;
  status: string;
  totals: Record<string, unknown>;
  sharedAt: string;
  currency: string;
}

interface ActiveProject {
  id: string;
  name: string;
  status: string;
  engagementType: string;
  client?: { name: string };
  portal?: { displayName: string };
  tasks: Array<{ title: string; status: string; executionType: string }>;
}

interface DailySummary {
  content: string | null;
  generatedBy?: string;
  createdAt?: string;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short"
  });
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Not generated yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDayLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Upcoming";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);

  if (compare.getTime() === today.getTime()) {
    return "Today";
  }

  if (compare.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function formatTimeRange(event: CalendarEvent) {
  const startValue = event.start.dateTime ?? event.start.date;
  const endValue = event.end.dateTime ?? event.end.date;

  if (!startValue) {
    return "Time TBC";
  }

  if (event.start.date && !event.start.dateTime) {
    return "All day";
  }

  const start = new Date(startValue);
  const end = endValue ? new Date(endValue) : null;

  if (Number.isNaN(start.getTime())) {
    return "Time TBC";
  }

  const startLabel = start.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const endLabel =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit"
        })
      : null;

  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

function extractSenderName(from: string) {
  const match = from.match(/"?([^"<]+)"?\s*<.+>/);
  return match?.[1]?.trim() || from.split("<")[0]?.trim() || from;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function extractQuoteTotal(totals: Record<string, unknown>) {
  const candidates = [
    totals.total,
    totals.grandTotal,
    totals.totalAmount,
    totals.finalTotal
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      "amount" in candidate &&
      typeof (candidate as { amount?: unknown }).amount === "number"
    ) {
      return (candidate as { amount: number }).amount;
    }
  }

  return 0;
}

function formatCurrency(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "shared":
      return "bg-[rgba(79,142,247,0.18)] text-[#78a9ff]";
    case "pending":
      return "bg-[rgba(240,160,80,0.18)] text-[#f0a050]";
    case "completed":
      return "bg-[rgba(45,212,160,0.16)] text-[#54e1b1]";
    default:
      return "bg-[rgba(255,255,255,0.08)] text-text-secondary";
  }
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-3/4 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
      <div className="h-5 w-full animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
      <div className="h-5 w-5/6 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
    </div>
  );
}

export default function MulooCommandCentre() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailConnected, setEmailConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [xeroSummary, setXeroSummary] = useState<XeroSummary | null>(null);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [summary, setSummary] = useState<DailySummary>({ content: null });
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [todoDraft, setTodoDraft] = useState("");
  const [todoNotesDraft, setTodoNotesDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTodos() {
    const response = await fetch("/api/workspace/todos");

    if (!response.ok) {
      throw new Error("Failed to load workspace todos");
    }

    setTodos(await response.json());
  }

  async function loadEmails() {
    const response = await fetch("/api/workspace/emails/action-required");

    if (!response.ok) {
      throw new Error("Failed to load Gmail actions");
    }

    const body = await response.json();
    setEmailConnected(Boolean(body.connected));
    setEmails(Array.isArray(body.emails) ? body.emails : []);
  }

  async function loadCalendar() {
    const response = await fetch("/api/workspace/calendar/events");

    if (!response.ok) {
      throw new Error("Failed to load calendar events");
    }

    const body = await response.json();
    setCalendarConnected(Boolean(body.connected));
    setCalendarEvents(Array.isArray(body.events) ? body.events : []);
  }

  async function loadQuotes() {
    const response = await fetch("/api/workspace/quotes/pipeline");

    if (!response.ok) {
      throw new Error("Failed to load quotes pipeline");
    }

    setQuotes(await response.json());
  }

  async function loadProjects() {
    const response = await fetch("/api/workspace/projects/active");

    if (!response.ok) {
      throw new Error("Failed to load active projects");
    }

    setProjects(await response.json());
  }

  async function loadXero() {
    const response = await fetch("/api/workspace/xero/invoices");

    if (!response.ok) {
      throw new Error("Failed to load Xero summary");
    }

    const body = await response.json();
    setXeroConnected(Boolean(body.connected));
    setXeroSummary(body.summary ?? null);
  }

  async function loadSummary() {
    const response = await fetch("/api/workspace/summary/latest");

    if (!response.ok) {
      throw new Error("Failed to load daily summary");
    }

    setSummary(await response.json());
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadSummary(),
        loadTodos(),
        loadEmails(),
        loadCalendar(),
        loadQuotes(),
        loadProjects(),
        loadXero()
      ]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load Command Centre"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const hasCalendarConnected = searchParams.get("calendarConnected");
    const hasXeroConnected = searchParams.get("xeroConnected");

    if (!hasCalendarConnected && !hasXeroConnected) {
      return;
    }

    void Promise.all([
      hasCalendarConnected ? loadCalendar() : Promise.resolve(),
      hasXeroConnected ? loadXero() : Promise.resolve()
    ]).finally(() => {
      router.replace("/workspace");
    });
  }, [router, searchParams]);

  const sortedTodos = [
    ...todos
      .filter((todo) => !todo.completed)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    ...todos
      .filter((todo) => todo.completed)
      .sort((left, right) => left.sortOrder - right.sortOrder)
  ];

  const groupedCalendarEvents = calendarEvents.reduce<
    Record<string, CalendarEvent[]>
  >((groups, event) => {
    const label = formatDayLabel(event.start.dateTime ?? event.start.date ?? "");
    groups[label] = groups[label] ? [...groups[label], event] : [event];
    return groups;
  }, {});

  async function handleAddTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!todoDraft.trim()) {
      return;
    }

    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: todoDraft,
          notes: todoNotesDraft || undefined
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create todo");
      }

      setTodoDraft("");
      setTodoNotesDraft("");
      await loadTodos();
    } catch (todoError) {
      setError(
        todoError instanceof Error ? todoError.message : "Failed to create todo"
      );
    }
  }

  async function patchTodo(todoId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/workspace/todos/${encodeURIComponent(todoId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to update todo");
    }

    await loadTodos();
  }

  async function handleDeleteTodo(todoId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/workspace/todos/${encodeURIComponent(todoId)}`, {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete todo");
      }

      await loadTodos();
    } catch (todoError) {
      setError(
        todoError instanceof Error ? todoError.message : "Failed to delete todo"
      );
    }
  }

  async function handleMoveTodo(todo: Todo, direction: -1 | 1) {
    const index = sortedTodos.findIndex((item) => item.id === todo.id);
    const target = sortedTodos[index + direction];

    if (!target) {
      return;
    }

    setError(null);

    try {
      await patchTodo(todo.id, { sortOrder: target.sortOrder });
    } catch (todoError) {
      setError(
        todoError instanceof Error ? todoError.message : "Failed to reorder todo"
      );
    }
  }

  async function handleClearCompleted() {
    setError(null);

    try {
      const response = await fetch("/api/workspace/todos", {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to clear completed todos");
      }

      await loadTodos();
    } catch (todoError) {
      setError(
        todoError instanceof Error
          ? todoError.message
          : "Failed to clear completed todos"
      );
    }
  }

  async function handleRegenerate() {
    setSummaryLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/summary/generate", {
        method: "POST"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate summary");
      }

      setSummary(body);
      setFeedback("Daily briefing regenerated.");
    } catch (summaryError) {
      setError(
        summaryError instanceof Error
          ? summaryError.message
          : "Failed to generate summary"
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleGmailConnect() {
    setError(null);

    try {
      const response = await fetch("/api/email-oauth/google/start", {
        method: "POST"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.authUrl) {
        throw new Error(body?.error ?? "Failed to start Gmail connection");
      }

      window.location.href = body.authUrl;
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Failed to start Gmail connection"
      );
    }
  }

  const hasCompletedTodos = todos.some((todo) => todo.completed);

  return (
    <AppShell>
      <main className="mx-auto max-w-screen-2xl space-y-6 p-6">
        <section className="overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top_right,rgba(224,82,156,0.22),transparent_35%),linear-gradient(180deg,#111936_0%,#0d1530_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-text-muted">
                Command Centre
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                AI Daily Briefing
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                A single executive snapshot across open actions, client delivery,
                meetings, quotes, and receivables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={summaryLoading}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {summaryLoading ? "Generating..." : "Regenerate"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(9,13,31,0.52)] p-5">
            {summaryLoading || (loading && !summary.content) ? (
              <SummarySkeleton />
            ) : summary.content ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white">
                {summary.content}
              </pre>
            ) : (
              <p className="text-sm text-text-secondary">
                No daily briefing yet. Generate one to get a cross-workspace
                summary.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-text-muted">
            Generated by {summary.generatedBy ?? "not yet generated"} ·{" "}
            {formatDateTime(summary.createdAt)}
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.35)] bg-[rgba(58,21,32,0.72)] px-5 py-4 text-sm text-white">
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div className="rounded-2xl border border-[rgba(45,212,160,0.28)] bg-[rgba(13,48,40,0.65)] px-5 py-4 text-sm text-white">
            {feedback}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">To-do list</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Track the next operational moves without leaving the dashboard.
                  </p>
                </div>
                <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs text-text-secondary">
                  {todos.length} items
                </span>
              </div>

              <form className="mt-5 space-y-3" onSubmit={handleAddTodo}>
                <input
                  value={todoDraft}
                  onChange={(event) => setTodoDraft(event.target.value)}
                  placeholder="Add a new todo"
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
                <textarea
                  value={todoNotesDraft}
                  onChange={(event) => setTodoNotesDraft(event.target.value)}
                  placeholder="Optional notes"
                  className="min-h-[88px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                >
                  Add
                </button>
              </form>

              <div className="mt-6 space-y-3">
                {sortedTodos.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                    No open todos yet.
                  </p>
                ) : (
                  sortedTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`rounded-2xl border px-4 py-4 ${
                        todo.completed
                          ? "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)]"
                          : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() =>
                            void patchTodo(todo.id, {
                              completed: !todo.completed
                            }).catch((todoError) =>
                              setError(
                                todoError instanceof Error
                                  ? todoError.message
                                  : "Failed to update todo"
                              )
                            )
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              todo.completed
                                ? "text-text-secondary line-through"
                                : "text-white"
                            }`}
                          >
                            {todo.title}
                          </p>
                          {todo.notes ? (
                            <p className="mt-1 text-sm text-text-secondary">
                              {todo.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleMoveTodo(todo, -1)}
                            className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1 text-xs text-text-secondary"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveTodo(todo, 1)}
                            className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1 text-xs text-text-secondary"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTodo(todo.id)}
                            className="rounded-lg border border-[rgba(224,80,96,0.25)] px-2 py-1 text-xs text-[#ff9aa7]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {hasCompletedTodos ? (
                <button
                  type="button"
                  onClick={() => void handleClearCompleted()}
                  className="mt-5 rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
                >
                  Clear completed
                </button>
              ) : null}
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Gmail action required
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Unread or starred messages that likely need your attention.
                  </p>
                </div>
                {!emailConnected ? (
                  <button
                    type="button"
                    onClick={() => void handleGmailConnect()}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                  >
                    Connect Gmail
                  </button>
                ) : null}
              </div>

              {!emailConnected ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  Connect Gmail to surface starred or unread emails that need action.
                </p>
              ) : emails.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  No action-required emails right now.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {emails.slice(0, 10).map((email) => (
                    <div
                      key={email.id}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-secondary">
                            {extractSenderName(email.from)}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-white">
                            {email.subject}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {truncate(email.snippet, 80)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-muted">
                            {formatRelativeDate(email.date)}
                          </p>
                          <a
                            href={email.gmailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm font-medium text-[#78a9ff]"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Calendar meetings
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Upcoming meetings across the next week, grouped by day.
                  </p>
                </div>
                {!calendarConnected ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/workspace/calendar/auth";
                    }}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                  >
                    Connect Google Calendar
                  </button>
                ) : null}
              </div>

              {!calendarConnected ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  Connect Google Calendar to show the next 7 days of meetings.
                </p>
              ) : calendarEvents.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  No calendar events in the next week.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  {Object.entries(groupedCalendarEvents).map(([label, items]) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                        {label}
                      </p>
                      <div className="mt-3 space-y-3">
                        {items.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                                  {formatTimeRange(event)}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {event.summary}
                                </p>
                                {event.location ? (
                                  <p className="mt-1 text-sm text-text-secondary">
                                    {event.location}
                                  </p>
                                ) : event.hangoutLink ? (
                                  <a
                                    href={event.hangoutLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-block text-sm text-[#78a9ff]"
                                  >
                                    Join meeting
                                  </a>
                                ) : null}
                              </div>
                              {event.attendees && event.attendees.length > 1 ? (
                                <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                                  {event.attendees.length} attendees
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Quotes pipeline
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Commercial items still moving toward approval.
                  </p>
                </div>
                <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs text-text-secondary">
                  {quotes.length} open
                </span>
              </div>

              {quotes.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  No quotes in pipeline.
                </p>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                  <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.8fr] gap-3 bg-[#0b1126] px-4 py-3 text-xs uppercase tracking-[0.14em] text-text-muted">
                    <span>Client</span>
                    <span>Project</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span>Shared</span>
                  </div>
                  {quotes.map((quote) => (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => router.push(`/projects/${quote.projectId}/quote`)}
                      className="grid w-full grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.8fr] gap-3 border-t border-[rgba(255,255,255,0.06)] px-4 py-4 text-left transition-colors hover:bg-background-elevated"
                    >
                      <span className="truncate text-sm text-white">
                        {quote.clientName}
                      </span>
                      <span className="truncate text-sm text-white">
                        {quote.projectName}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {formatCurrency(
                          quote.currency,
                          extractQuoteTotal(quote.totals)
                        )}
                      </span>
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                          quote.status
                        )}`}
                      >
                        {quote.status}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {formatRelativeDate(quote.sharedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Active projects</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Delivery work still in motion across the workspace.
              </p>
            </div>
            <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs text-text-secondary">
              {projects.length} active
            </span>
          </div>

          {projects.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
              No active projects.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/projects/${project.id}/delivery`)}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 text-left transition-colors hover:bg-background-elevated"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {project.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                        project.status
                      )}`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {project.client?.name ?? "No client assigned"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                      {project.engagementType.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-[rgba(79,142,247,0.14)] px-3 py-1 text-xs text-[#78a9ff]">
                      {project.tasks.length} tasks open
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Invoice summary</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Outstanding and overdue receivables from Xero.
              </p>
            </div>
            {!xeroConnected ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/workspace/xero/auth";
                }}
                className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
              >
                Connect Xero
              </button>
            ) : null}
          </div>

          {!xeroConnected ? (
            <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
              Connect Xero to monitor outstanding and overdue invoices.
            </p>
          ) : (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                  <p className="text-sm text-text-secondary">Outstanding</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatCurrency(
                      xeroSummary?.currency ?? "NZD",
                      xeroSummary?.totalOutstanding ?? 0
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                  <p className="text-sm text-text-secondary">Overdue</p>
                  <p className="mt-2 text-3xl font-semibold text-[#ff9aa7]">
                    {formatCurrency(
                      xeroSummary?.currency ?? "NZD",
                      xeroSummary?.totalOverdue ?? 0
                    )}
                  </p>
                </div>
              </div>

              {!xeroSummary?.invoices?.length ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-5 text-sm text-text-secondary">
                  No outstanding invoices.
                </p>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                  <div className="grid grid-cols-[0.8fr_1.4fr_0.9fr_0.9fr_0.8fr] gap-3 bg-[#0b1126] px-4 py-3 text-xs uppercase tracking-[0.14em] text-text-muted">
                    <span>Invoice</span>
                    <span>Contact</span>
                    <span>Due date</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {xeroSummary.invoices.map((invoice) => (
                    <div
                      key={invoice.invoiceNumber}
                      className="grid grid-cols-[0.8fr_1.4fr_0.9fr_0.9fr_0.8fr] gap-3 border-t border-[rgba(255,255,255,0.06)] px-4 py-4"
                    >
                      <span className="text-sm text-white">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-sm text-white">{invoice.contact}</span>
                      <span className="text-sm text-text-secondary">
                        {formatDateTime(invoice.dueDate)}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {formatCurrency(
                          xeroSummary.currency,
                          invoice.amountDue
                        )}
                      </span>
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
                          invoice.isOverdue
                            ? "bg-[rgba(224,80,96,0.18)] text-[#ff9aa7]"
                            : getStatusBadgeClass(invoice.status)
                        }`}
                      >
                        {invoice.isOverdue ? "OVERDUE" : invoice.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
