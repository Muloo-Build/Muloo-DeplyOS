"use client";

import { useMemo, useState } from "react";

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
    <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Project Assistant
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Ask about this project
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            This assistant is limited to the information already visible in this portal.
            It can help explain the project summary, delivery status, and next steps.
          </p>
        </div>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Scoped to this project
        </span>
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

      <div className="mt-5 space-y-3">
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
        className="mt-5 flex gap-3"
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
          className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none resize-none"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="self-end rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Thinking..." : "Ask"}
        </button>
      </form>
    </section>
  );
}
