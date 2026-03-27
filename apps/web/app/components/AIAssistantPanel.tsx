"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-muloo-gradient text-white shadow-[0_20px_45px_rgba(0,0,0,0.35)] transition hover:scale-[1.02] sm:bottom-6 sm:right-6"
        aria-label="Open AI Assistant"
      >
        <Bot size={22} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[rgba(3,7,18,0.55)]"
            aria-label="Close AI Assistant"
          />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[28rem] flex-col border-l border-white/10 bg-[#071030] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-brand-teal" />
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    AI Assistant
                  </p>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{pageLabel}</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {projectContext
                    ? `${projectContext.name} · ${projectContext.clientName}`
                    : "Workspace-aware help and actions"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-text-secondary transition hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl border p-4 text-sm ${
                    message.role === "assistant"
                      ? "border-white/10 bg-white/5 text-text-secondary"
                      : "border-brand-teal/20 bg-brand-teal/10 text-white"
                  }`}
                >
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

            <div className="border-t border-white/10 px-4 py-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about this page or request a safe action..."
                  className="min-h-[96px] w-full resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-text-muted"
                />
                <div className="flex items-center justify-between gap-3 px-2 pb-1">
                  <p className="text-xs text-text-muted">
                    {projectContext
                      ? "Project context is attached."
                      : "Page context is attached."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void submitMessage()}
                    disabled={busy || !input.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-muloo-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Send
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
