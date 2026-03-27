"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ProjectMessage {
  id: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
}

function formatTs(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function ProjectMessagesPanel({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/messages`);
        if (!res.ok) return;
        const body = await res.json();
        setMessages((body.messages ?? []).slice().reverse());
      } catch {
      }
    }
    void load();
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), senderName: "Muloo" })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to send");
      setMessages((prev) => [...prev, body.message]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[320px] min-h-[120px] overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-text-muted">No messages yet. Send a quick update to the client below.</p>
        ) : (
          messages.map((msg) => {
            const isInternal = msg.senderType === "internal";
            return (
              <div
                key={msg.id}
                className={`rounded-2xl p-4 ${isInternal ? "bg-[#0d1733] border border-[rgba(123,226,239,0.15)]" : "bg-[#0b1126] border border-[rgba(255,255,255,0.07)]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${isInternal ? "text-[#7be2ef]" : "text-text-muted"}`}>
                    {msg.senderName}
                  </span>
                  <span className="text-xs text-text-muted">{formatTs(msg.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-text-secondary whitespace-pre-wrap">{msg.body}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="text-xs text-[#ff8f9c]">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder="Send a quick update to the client... (Ctrl+Enter to send)"
          rows={3}
          className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none resize-none"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="self-end rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Messages sent here are visible to the client in their project portal. They will not see any internal notes or agent details.
      </p>
    </div>
  );
}

export default function CommsTab(props: {
  projectId: string;
  emailComposer: ReactNode;
  agendaBuilder: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="brand-surface rounded-3xl border p-6">
          <h3 className="text-lg font-semibold text-white">Email composer</h3>
          <div className="mt-4">{props.emailComposer}</div>
        </section>
        <section className="brand-surface rounded-3xl border p-6">
          <h3 className="text-lg font-semibold text-white">Agenda builder</h3>
          <div className="mt-4">{props.agendaBuilder}</div>
        </section>
      </div>

      <section className="brand-surface rounded-3xl border p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Client comms</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Project messages</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Quick messages visible to the client in their project portal. Use for status updates, clarifications, and next step nudges.
        </p>
        <div className="mt-5">
          <ProjectMessagesPanel projectId={props.projectId} />
        </div>
      </section>
    </div>
  );
}
