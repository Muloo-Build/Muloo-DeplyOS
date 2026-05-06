"use client";

import { useEffect, useMemo, useState } from "react";

import WorkRequestsInbox from "./WorkRequestsInbox";

interface InboxProject {
  id: string;
  name: string;
}

interface InboxMessage {
  id: string;
  projectId: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
  project: InboxProject;
}

interface SubmissionAlert {
  project: InboxProject;
  updatedAt: string | null;
  sessionNumber: number | null;
  submittedByName: string | null;
}

export default function InternalInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [submissionAlerts, setSubmissionAlerts] = useState<SubmissionAlert[]>([]);
  const [projects, setProjects] = useState<InboxProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [inboxResponse, projectsResponse] = await Promise.all([
          fetch("/api/inbox"),
          fetch("/api/projects")
        ]);

        if (!inboxResponse.ok || !projectsResponse.ok) {
          throw new Error("Failed to load inbox");
        }

        const [inboxBody, projectsBody] = await Promise.all([
          inboxResponse.json(),
          projectsResponse.json()
        ]);

        setMessages(inboxBody.messages ?? []);
        setSubmissionAlerts(inboxBody.submissionAlerts ?? []);
        setProjects(
          (projectsBody.projects ?? []).map((project: InboxProject) => ({
            id: project.id,
            name: project.name
          }))
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load inbox"
        );
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
        `/api/projects/${encodeURIComponent(selectedProjectId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            body: draft,
            senderName: "Muloo"
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send message");
      }

      const project = projects.find((item) => item.id === selectedProjectId);

      setMessages((current) => [
        {
          ...body.message,
          project: project ?? { id: selectedProjectId, name: "Project" }
        },
        ...current
      ]);
      setDraft("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send message"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
        <p className="text-sm uppercase tracking-[0.14em] text-text-3">
          Requests
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Work request triage
        </h2>
        <p className="mt-2 text-text-2">
          Client-submitted quote requests, job briefs, and change requests land
          here for review and conversion.
        </p>
        <div className="mt-6">
          <WorkRequestsInbox />
        </div>
      </section>

      <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
        <p className="text-sm uppercase tracking-[0.14em] text-text-3">
          Messages
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Project-linked messaging
        </h2>
        <p className="mt-2 text-text-2">
          Use quick project messages for clarifications, next steps, and
          lightweight coordination without leaving DeployOS.
        </p>

        {error ? (
          <div className="mt-5 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {submissionAlerts.length > 0 ? (
            <div className="rounded-[14px] border border-[rgba(123,226,239,0.18)] bg-[rgba(123,226,239,0.07)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                New client inputs
              </p>
              <div className="mt-3 space-y-3">
                {submissionAlerts.map((alert) => (
                  <a
                    key={`${alert.project.id}-${alert.sessionNumber ?? "session"}`}
                    href={`/projects/${alert.project.id}/inputs`}
                    className="block rounded-[14px] border border-ink-4 bg-ink-2 p-4 transition hover:border-ink-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {alert.project.name}
                        </p>
                        <p className="mt-1 text-sm text-text-2">
                          {alert.submittedByName ?? "Client contact"} updated{" "}
                          {alert.sessionNumber
                            ? `section ${alert.sessionNumber}`
                            : "their inputs"}
                          .
                        </p>
                      </div>
                      <span className="text-xs text-text-3">
                        {alert.updatedAt
                          ? new Date(alert.updatedAt).toLocaleString("en-ZA")
                          : ""}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
            >
              <option value="">Choose project</option>
              {projects.map((project) => (
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
            placeholder="Write a quick project update or request..."
            className="min-h-[120px] w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div className="mt-6 space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-5">
              <p className="text-sm text-text-2">
                {selectedProjectId
                  ? "No messages for this project yet. Send the first one above."
                  : "No project messages yet. Choose a project and send a message above."}
              </p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-[14px] border border-ink-4 bg-ink-2 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                      {message.project.name}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {message.senderName}
                    </p>
                  </div>
                  <span className="text-xs text-text-3">
                    {new Date(message.createdAt).toLocaleString("en-ZA")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-2">
                  {message.body}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
