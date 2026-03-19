"use client";

import { useEffect, useMemo, useState } from "react";

import ClientShell from "./ClientShell";

interface ClientInboxMessage {
  id: string;
  projectId: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  };
}

interface ClientInboxRequest {
  id: string;
  title: string;
  serviceFamily: string;
  requestType: string;
  summary: string;
  status: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  } | null;
}

interface ClientProjectOption {
  role: string;
  project: {
    id: string;
    name: string;
  };
}

export default function ClientInbox() {
  const [messages, setMessages] = useState<ClientInboxMessage[]>([]);
  const [requests, setRequests] = useState<ClientInboxRequest[]>([]);
  const [projects, setProjects] = useState<ClientProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [inboxResponse, projectsResponse] = await Promise.all([
          fetch("/api/client/inbox", { credentials: "include" }),
          fetch("/api/client/projects", { credentials: "include" })
        ]);

        if (!inboxResponse.ok || !projectsResponse.ok) {
          throw new Error("Failed to load inbox");
        }

        const [inboxBody, projectsBody] = await Promise.all([
          inboxResponse.json(),
          projectsResponse.json()
        ]);

        setMessages(inboxBody.messages ?? []);
        setRequests(inboxBody.workRequests ?? []);
        setProjects(projectsBody.projects ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load inbox");
      }
    }

    void loadData();
  }, []);

  const filteredMessages = useMemo(
    () =>
      selectedProjectId
        ? messages.filter((message) => message.projectId === selectedProjectId)
        : messages,
    [messages, selectedProjectId]
  );

  async function sendMessage() {
    if (!selectedProjectId || !draft.trim()) {
      setError("Choose a project and enter a message");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/client/projects/${encodeURIComponent(selectedProjectId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ body: draft })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send message");
      }

      const project = projects.find((item) => item.project.id === selectedProjectId);

      setMessages((current) => [
        {
          ...body.message,
          project: project?.project ?? { id: selectedProjectId, name: "Project" }
        },
        ...current
      ]);
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientShell
      title="Inbox"
      subtitle="Project-linked messages, updates, and work requests in one place."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Messages
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Project conversations
          </h2>
          <p className="mt-2 text-text-secondary">
            Use quick project messages for clarifications, progress updates, and
            approval prompts without needing email.
          </p>

          {error ? (
            <div className="mt-5 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              >
                <option value="">Choose project</option>
                {projects.map(({ project }) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={saving}
                className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Sending..." : "Send"}
              </button>
            </div>

            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Send Muloo a quick message about this project..."
              className="min-h-[120px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div className="mt-6 space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4 text-sm text-text-secondary">
                No project messages yet.
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {message.project.name}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {message.senderName}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">
                      {new Date(message.createdAt).toLocaleString("en-ZA")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">{message.body}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Requests
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Submitted work requests
          </h2>
          <p className="mt-2 text-text-secondary">
            Track quote requests, job specs, and change requests submitted to
            Muloo from this workspace.
          </p>

          <div className="mt-6 space-y-4">
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4 text-sm text-text-secondary">
                No work requests yet.
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {request.requestType.replace(/_/g, " ")}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-white">
                        {request.title}
                      </h4>
                    </div>
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    {request.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ClientShell>
  );
}
