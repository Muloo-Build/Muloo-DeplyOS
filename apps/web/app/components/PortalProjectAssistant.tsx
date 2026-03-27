"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getPortalLabel,
  getPortalProjectPath,
  type PortalExperience
} from "./portalExperience";

type PortalSummary = {
  currentPhaseLabel: string;
  waitingOnLabel: string;
  nextSteps: Array<{
    title: string;
    detail: string;
    owner: string;
  }>;
};

type ChatMessage = {
  role: "assistant" | "user";
  body: string;
};

export default function PortalProjectAssistant({
  projectId,
  projectName,
  portalExperience,
  summary
}: {
  projectId: string;
  projectName: string;
  portalExperience: PortalExperience;
  summary: PortalSummary;
}) {
  const starterPrompts = useMemo(
    () => [
      "What is this project about?",
      "What should our team do next?",
      "What is Muloo working on right now?",
      "Explain the current phase in simple terms."
    ],
    []
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      body: `I can help explain ${projectName} using only the information visible in this portal. Current phase: ${summary.currentPhaseLabel}.`
    }
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [...current, { role: "user", body: trimmed }]);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/client/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          message: trimmed,
          projectId,
          pathname: getPortalProjectPath(portalExperience, projectId),
          pageLabel: `${getPortalLabel(portalExperience)} project portal`
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to contact the project assistant");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          body:
            typeof body?.answer === "string" && body.answer.trim().length > 0
              ? body.answer.trim()
              : "I can only answer from what is visible in this project portal right now."
        }
      ]);
    } catch (assistantError) {
      setError(
        assistantError instanceof Error
          ? assistantError.message
          : "Failed to contact the project assistant"
      );
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

      <div className="fixed bottom-5 right-5 z-50 flex items-end justify-end sm:bottom-7 sm:right-7">
        {open ? (
          <section className="mb-4 w-[min(92vw,28rem)] rounded-[28px] border border-[rgba(255,255,255,0.1)] bg-[#071127] p-5 shadow-[0_24px_80px_rgba(3,8,20,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Project Assistant
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Ask Muloo for help
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  This assistant is limited to what is already visible in this portal.
                  It can explain the summary, delivery status, and next steps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-sm text-text-secondary transition hover:border-[rgba(255,255,255,0.14)] hover:text-white"
                aria-label="Close project assistant"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={busy}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white transition hover:border-[rgba(255,255,255,0.14)] disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-5 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "assistant"
                      ? "border border-[rgba(123,226,239,0.18)] bg-[#0b1733] text-white"
                      : "border border-[rgba(255,255,255,0.07)] bg-[#0b1126] text-text-secondary"
                  }`}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                    {message.role === "assistant" ? "Assistant" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>

            {error ? (
              <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p>
            ) : null}

            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(draft);
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder="Ask about progress, next steps, or what this project means..."
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none resize-none"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Scoped to this project
                </span>
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Thinking..." : "Ask"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-3 rounded-full border border-[rgba(123,226,239,0.22)] bg-[linear-gradient(135deg,#0d1d3d_0%,#132b54_45%,#143f5e_100%)] px-4 py-3 text-left text-white shadow-[0_18px_45px_rgba(5,10,24,0.45)] transition hover:border-[rgba(123,226,239,0.42)] hover:shadow-[0_22px_55px_rgba(5,10,24,0.6)]"
          aria-label={open ? "Hide project assistant" : "Open project assistant"}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#51d0b0_0%,#7be2ef_100%)] text-[#071127] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-7 w-7"
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
          <span className="hidden min-w-0 sm:block">
            <span className="block text-[11px] uppercase tracking-[0.18em] text-[#9fddea]">
              AI Help
            </span>
            <span className="mt-1 block text-sm font-semibold leading-5 text-white">
              Ask Muloo
            </span>
          </span>
        </button>
      </div>
    </>
  );
}
