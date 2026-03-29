"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

type AssistantActionType =
  | "run_portal_audit"
  | "queue_dashboard_build"
  | "generate_email_draft"
  | "navigate";

interface AssistantAction {
  type: AssistantActionType;
  label: string;
  description?: string;
  path?: string;
}

interface AssistantMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: AssistantAction[];
}

interface AssistantProjectContext {
  id: string;
  name: string;
  status: string;
  clientName: string;
  portalId?: string | null;
}

interface AssistantResponse {
  answer: string;
  actions?: AssistantAction[];
}

function inferPageLabel(pathname: string) {
  if (pathname === "/" || pathname === "/command-centre" || pathname === "/workspace") {
    return "Command Centre";
  }

  if (pathname === "/projects") {
    return "Projects";
  }

  if (pathname.startsWith("/projects/portal-ops")) {
    return "Portal Ops";
  }

  if (pathname.startsWith("/projects/")) {
    return "Project Detail";
  }

  if (pathname.startsWith("/runs")) {
    return "Runs";
  }

  if (pathname.startsWith("/inbox")) {
    return "Inbox";
  }

  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  return "Workspace";
}

function getProjectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!match) {
    return null;
  }

  const projectId = match[1];
  if (!projectId || projectId === "new" || projectId === "portal-ops") {
    return null;
  }

  return projectId;
}

export default function AIAssistantPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectContext, setProjectContext] =
    useState<AssistantProjectContext | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text:
        "I can help you understand the current page, answer workspace questions, and trigger safe project actions like portal audits or draft generation."
    }
  ]);

  const pageLabel = useMemo(() => inferPageLabel(pathname), [pathname]);
  const projectId = useMemo(() => getProjectIdFromPath(pathname), [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectContext() {
      if (!projectId) {
        setProjectContext(null);
        return;
      }

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
        const body = await response.json().catch(() => null);

        if (!response.ok || cancelled) {
          return;
        }

        setProjectContext({
          id: body.project?.id ?? projectId,
          name: body.project?.name ?? "Project",
          status: body.project?.status ?? "unknown",
          clientName: body.project?.client?.name ?? "Unknown client",
          portalId: body.project?.portal?.id ?? null
        });
      } catch {
        if (!cancelled) {
          setProjectContext(null);
        }
      }
    }

    void loadProjectContext();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setMessages((currentMessages) => {
      const contextMessage: AssistantMessage = {
        id: `assistant-context-${pathname}`,
        role: "assistant",
        text: projectContext
          ? `You’re on ${pageLabel} for ${projectContext.name} (${projectContext.clientName}). Ask me about the project, or use a shortcut to trigger a safe action.`
          : `You’re on ${pageLabel}. Ask me about this page, or I can point you to the right workspace area.`
      };

      const nextMessages = currentMessages.filter(
        (message) => !message.id.startsWith("assistant-context-")
      );

      return [nextMessages[0], contextMessage, ...nextMessages.slice(1)];
    });
  }, [pageLabel, pathname, projectContext]);

  async function handleAction(action: AssistantAction) {
    if (action.type === "navigate" && action.path) {
      router.push(action.path);
      setOpen(false);
      return;
    }

    if (!projectContext?.id) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-result-${Date.now()}`,
          role: "assistant",
          text: "That action needs project context, so open a project page first."
        }
      ]);
      return;
    }

    setBusy(true);

    try {
      if (action.type === "run_portal_audit") {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectContext.id)}/run/portal-audit`,
          { method: "POST" }
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to queue portal audit");
        }

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-result-${Date.now()}`,
            role: "assistant",
            text: `Portal audit queued. Job ${body.job?.id ?? body.jobId ?? "created"} is now in the runs queue.`,
            actions: [
              {
                type: "navigate",
                label: "Open Runs",
                path: "/runs"
              }
            ]
          }
        ]);
      } else if (action.type === "generate_email_draft") {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectContext.id)}/email/draft`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notes: input.trim()
            })
          }
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to generate email draft");
        }

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-result-${Date.now()}`,
            role: "assistant",
            text: `Email draft generated:\n\n${String(body.draft ?? "").slice(0, 800)}`
          }
        ]);
      } else if (action.type === "queue_dashboard_build") {
        if (!projectContext.portalId) {
          throw new Error("This project does not have a connected portal yet.");
        }

        const response = await fetch("/api/agents/marketing-dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectContext.id,
            portalId: projectContext.portalId,
            dashboardName: "Marketing Dashboard",
            dryRun: true
          })
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to queue dashboard build plan");
        }

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-result-${Date.now()}`,
            role: "assistant",
            text: `Dashboard build plan queued. Job ${body.jobId ?? "created"} is ready in Runs.`,
            actions: [
              {
                type: "navigate",
                label: "Open Runs",
                path: "/runs"
              }
            ]
          }
        ]);
      }
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "That action could not be completed."
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!input.trim() || busy) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: input.trim()
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setBusy(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          pathname,
          pageLabel,
          ...(projectContext ? { project: projectContext } : {})
        })
      });

      const body = (await response.json().catch(() => null)) as AssistantResponse | null;

      if (!response.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? "Assistant request failed");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: body?.answer ?? "I couldn’t generate a response just now.",
          actions: body?.actions ?? []
        }
      ]);
      setInput("");
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-fallback-${Date.now()}`,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "The assistant is unavailable right now."
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[#020617]/55 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end sm:bottom-5 sm:right-5">
        {open ? (
          <section className="mb-4 w-[min(92vw,28rem)] rounded-[28px] border border-[rgba(255,255,255,0.1)] bg-[#071127] p-5 shadow-[0_24px_80px_rgba(3,8,20,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  AI Assistant
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Ask Muloo
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {projectContext
                    ? `You’re working inside ${projectContext.name} for ${projectContext.clientName}. I can explain the project, answer workspace questions, and trigger safe actions.`
                    : `You’re on ${pageLabel}. I can help with workspace navigation, page questions, and safe operational actions.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-sm text-text-secondary transition hover:border-[rgba(255,255,255,0.14)] hover:text-white"
                aria-label="Close AI assistant"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {projectContext ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void handleAction({
                        type: "run_portal_audit",
                        label: "Run portal audit"
                      })
                    }
                    disabled={busy}
                    className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white transition hover:border-[rgba(255,255,255,0.14)] disabled:opacity-60"
                  >
                    Run portal audit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleAction({
                        type: "generate_email_draft",
                        label: "Draft project email"
                      })
                    }
                    disabled={busy}
                    className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white transition hover:border-[rgba(255,255,255,0.14)] disabled:opacity-60"
                  >
                    Draft project email
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void handleAction({
                      type: "navigate",
                      label: "Open projects",
                      path: "/projects"
                    })
                  }
                  className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white transition hover:border-[rgba(255,255,255,0.14)]"
                >
                  Open projects
                </button>
              )}
            </div>

            <div className="mt-5 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "assistant"
                      ? "border border-[rgba(123,226,239,0.18)] bg-[#0b1733] text-white"
                      : "border border-[rgba(255,255,255,0.07)] bg-[#0b1126] text-text-secondary"
                  }`}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                    {message.role === "assistant" ? "Assistant" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.actions && message.actions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.actions.map((action, index) => (
                        <button
                          key={`${message.id}-${action.label}-${index}`}
                          type="button"
                          onClick={() => void handleAction(action)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:border-brand-teal/50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage();
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder="Ask about this page or request a safe action..."
                className="w-full resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  {projectContext ? "Project context attached" : "Page context attached"}
                </span>
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="group flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(123,226,239,0.18)] bg-[linear-gradient(180deg,rgba(10,20,38,0.96)_0%,rgba(8,14,28,0.98)_100%)] text-[#dff7fb] shadow-[0_14px_36px_rgba(5,10,24,0.36)] transition hover:-translate-y-0.5 hover:border-[rgba(123,226,239,0.34)] hover:text-white hover:shadow-[0_18px_44px_rgba(5,10,24,0.44)]"
          aria-label={open ? "Hide AI assistant" : "Open AI assistant"}
          title="Open AI assistant"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(123,226,239,0.14)] bg-[radial-gradient(circle_at_top,rgba(123,226,239,0.16),rgba(123,226,239,0.02)_70%)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] transition group-hover:scale-105"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 10h10" />
              <path d="M7 14h6" />
              <path d="M12 3c5.523 0 10 3.806 10 8.5S17.523 20 12 20c-1.09 0-2.14-.148-3.118-.42L4 21l1.462-3.736C3.925 15.73 2 13.73 2 11.5 2 6.806 6.477 3 12 3Z" />
            </svg>
          </span>
        </button>
      </div>
    </>
  );
}
