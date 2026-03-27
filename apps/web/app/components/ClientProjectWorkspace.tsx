"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import ClientShell from "./ClientShell";
import {
  clientSessionDefinitions,
  createDefaultClientQuestionnaireDefinitionMap,
  type ClientQuestionnaireDefinitionMap
} from "./clientQuestionnaire";
import {
  type PortalExperience,
  getPortalDeliveryPath,
  getPortalQuotePath
} from "./portalExperience";

type WorkspaceTab = "overview" | "tasks" | "messages" | "delivery";

interface ClientMessage {
  id: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface ClientProjectDetail {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  role: string;
  canCompleteQuestionnaire: boolean;
  project: {
    id: string;
    name: string;
    status: string;
    quoteApprovalStatus?: string | null;
    quoteSharedAt?: string | null;
    quoteApprovedAt?: string | null;
    quoteApprovedByName?: string | null;
    quoteApprovedByEmail?: string | null;
    scopeLockedAt?: string | null;
    scopeType?: string | null;
    commercialBrief?: string | null;
    clientQuestionnaireConfig?: ClientQuestionnaireDefinitionMap | null;
    engagementType: string;
    selectedHubs: string[];
    updatedAt: string;
    portalQuoteEnabled?: boolean;
    client: {
      name: string;
      website?: string | null;
    };
  };
  submissions: Array<{
    id: string;
    sessionNumber: number;
    status: string;
    answers: Record<string, string>;
    updatedAt: string;
  }>;
}

type SessionSaveState = {
  status: "idle" | "pending" | "saving" | "saved" | "error";
  message: string | null;
};

function formatTs(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function statusForDraft(answers: Record<string, string>) {
  const values = Object.values(answers);
  if (values.length === 0 || values.every((v) => v.trim().length === 0)) return "Not started";
  if (values.every((v) => v.trim().length > 0)) return "Complete";
  return "In progress";
}

function createDrafts(
  submissions: ClientProjectDetail["submissions"],
  definitions: ClientQuestionnaireDefinitionMap
): Record<number, Record<string, string>> {
  return Object.keys(definitions).reduce<Record<number, Record<string, string>>>(
    (drafts, sessionNumberText) => {
      const sessionNumber = Number(sessionNumberText);
      const submission = submissions.find((s) => s.sessionNumber === sessionNumber);
      const questions = definitions[sessionNumber]?.questions ?? [];
      drafts[sessionNumber] = Object.fromEntries(
        questions.map((q) => [q.key, submission?.answers?.[q.key] ?? ""])
      );
      return drafts;
    },
    Object.fromEntries(
      Object.keys(definitions).map((k) => [Number(k), {}])
    ) as Record<number, Record<string, string>>
  );
}

function createSessionSaveStateMap(
  submissions: ClientProjectDetail["submissions"]
): Record<number, SessionSaveState> {
  return submissions.reduce<Record<number, SessionSaveState>>((state, sub) => {
    state[sub.sessionNumber] = {
      status: "saved",
      message: formatTs(sub.updatedAt) ? `Saved ${formatTs(sub.updatedAt)}` : "Saved"
    };
    return state;
  }, {});
}

function projectStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Getting started",
    active: "Active",
    in_progress: "In progress",
    complete: "Completed",
    on_hold: "On hold",
    cancelled: "Cancelled"
  };
  return map[status] ?? status;
}

function projectStatusColor(status: string) {
  if (status === "active" || status === "in_progress") return "text-[#51d0b0]";
  if (status === "complete") return "text-[#7be2ef]";
  if (status === "on_hold") return "text-[#f0c060]";
  return "text-text-secondary";
}

export default function ClientProjectWorkspace({
  projectId,
  portalExperience = "client"
}: {
  projectId: string;
  portalExperience?: PortalExperience;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [questionnaireDefinitions, setQuestionnaireDefinitions] =
    useState<ClientQuestionnaireDefinitionMap>(createDefaultClientQuestionnaireDefinitionMap());
  const [detail, setDetail] = useState<ClientProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({ 1: {}, 2: {}, 3: {}, 4: {} });
  const [sessionSaveState, setSessionSaveState] = useState<Record<number, SessionSaveState>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  const autosaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
  const dirtySessionsRef = useRef<Record<number, boolean>>({});
  const messagesBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const [projectRes, messagesRes] = await Promise.all([
          fetch(`/api/client/projects/${encodeURIComponent(projectId)}`, { credentials: "include" }),
          fetch(`/api/client/projects/${encodeURIComponent(projectId)}/messages`, { credentials: "include" })
        ]);
        if (!projectRes.ok) throw new Error("Failed to load project");
        const body = await projectRes.json();
        const nextDefs = body.project?.clientQuestionnaireConfig ?? clientSessionDefinitions;
        setDetail(body);
        setQuestionnaireDefinitions(nextDefs);
        setDrafts(createDrafts(body.submissions ?? [], nextDefs));
        setSessionSaveState(createSessionSaveStateMap(body.submissions ?? []));
        dirtySessionsRef.current = {};
        if (messagesRes.ok) {
          const msgBody = await messagesRes.json();
          setMessages((msgBody.messages ?? []).slice().reverse());
        }
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    void loadProject();
  }, [projectId]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (activeTab === "messages") {
      setTimeout(() => messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [activeTab, messages]);

  const sessionNumbers = useMemo(
    () =>
      Object.keys(questionnaireDefinitions)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b),
    [questionnaireDefinitions]
  );

  const completedCount = useMemo(
    () => Object.values(drafts).filter((a) => statusForDraft(a) === "Complete").length,
    [drafts]
  );

  const isStandaloneQuote = detail?.project.scopeType === "standalone_quote";
  const questionnaireAssigned = !isStandaloneQuote && detail?.canCompleteQuestionnaire !== false;
  const portalQuoteEnabled = detail?.project.portalQuoteEnabled !== false;
  const quoteApprovalStatus = detail?.project.quoteApprovalStatus ?? "draft";
  const quoteSharedAt = formatTs(detail?.project.quoteSharedAt);
  const quoteApprovedAt = formatTs(detail?.project.quoteApprovedAt);
  const quoteApprover = detail?.project.quoteApprovedByName || detail?.project.quoteApprovedByEmail || "client team";
  const clientName = detail ? `${detail.user.firstName} ${detail.user.lastName}`.trim() : "";

  function clearAutosaveTimer(sessionNumber: number) {
    const t = autosaveTimersRef.current[sessionNumber];
    if (t) { clearTimeout(t); delete autosaveTimersRef.current[sessionNumber]; }
  }

  function markSessionPending(sessionNumber: number) {
    setSessionSaveState((s) => ({ ...s, [sessionNumber]: { status: "pending", message: "Saving automatically..." } }));
  }

  function updateDraft(sessionNumber: number, fieldKey: string, value: string) {
    setDrafts((cur) => {
      const nextAnswers = { ...cur[sessionNumber], [fieldKey]: value };
      const next = { ...cur, [sessionNumber]: nextAnswers };
      draftsRef.current = next;
      dirtySessionsRef.current[sessionNumber] = true;
      clearAutosaveTimer(sessionNumber);
      markSessionPending(sessionNumber);
      autosaveTimersRef.current[sessionNumber] = setTimeout(() => {
        void saveSession(sessionNumber, { mode: "autosave", answersOverride: nextAnswers });
      }, 1200);
      return next;
    });
  }

  async function saveSession(sessionNumber: number, options?: { mode?: "manual" | "autosave"; answersOverride?: Record<string, string> }) {
    const mode = options?.mode ?? "manual";
    const answers = options?.answersOverride ?? draftsRef.current[sessionNumber] ?? {};
    clearAutosaveTimer(sessionNumber);
    setSaveError(null);
    setSessionSaveState((s) => ({ ...s, [sessionNumber]: { status: "saving", message: mode === "manual" ? "Saving now..." : "Saving automatically..." } }));
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/submissions/${sessionNumber}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ answers }) }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to save");
      setDetail((d) =>
        d ? {
          ...d,
          submissions: [
            ...d.submissions.filter((s) => s.sessionNumber !== sessionNumber),
            body.submission
          ].sort((a, b) => a.sessionNumber - b.sessionNumber)
        } : d
      );
      draftsRef.current = { ...draftsRef.current, [sessionNumber]: answers };
      dirtySessionsRef.current[sessionNumber] = false;
      setSessionSaveState((s) => ({
        ...s,
        [sessionNumber]: {
          status: "saved",
          message: body?.submission?.updatedAt
            ? `Saved ${formatTs(body.submission.updatedAt)}`
            : mode === "manual" ? "Saved" : "Saved automatically"
        }
      }));
    } catch (err) {
      dirtySessionsRef.current[sessionNumber] = true;
      setSaveError(err instanceof Error ? err.message : "Failed to save inputs");
      setSessionSaveState((s) => ({
        ...s,
        [sessionNumber]: { status: "error", message: "Could not save yet. Your latest edits are still on screen." }
      }));
    }
  }

  useEffect(() => {
    if (!questionnaireAssigned) return undefined;
    function flushPendingDrafts() {
      for (const [k, isDirty] of Object.entries(dirtySessionsRef.current)) {
        if (!isDirty) continue;
        const sessionNumber = Number(k);
        const answers = draftsRef.current[sessionNumber];
        if (!answers) continue;
        clearAutosaveTimer(sessionNumber);
        void fetch(
          `/api/client/projects/${encodeURIComponent(projectId)}/submissions/${sessionNumber}`,
          { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", keepalive: true, body: JSON.stringify({ answers }) }
        ).catch(() => null);
      }
    }
    function handleVisibilityChange() { if (document.hidden) flushPendingDrafts(); }
    window.addEventListener("beforeunload", flushPendingDrafts);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushPendingDrafts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      for (const k of Object.keys(autosaveTimersRef.current)) clearAutosaveTimer(Number(k));
    };
  }, [projectId, questionnaireAssigned]);

  async function sendMessage() {
    if (!messageDraft.trim()) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      const res = await fetch(`/api/client/projects/${encodeURIComponent(projectId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: messageDraft.trim(), senderName: clientName })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to send");
      setMessages((prev) => [...prev, body.message]);
      setMessageDraft("");
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setMessageSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    setDeletingMessageId(messageId);
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
    } finally {
      setDeletingMessageId(null);
    }
  }

  const tabs: { key: WorkspaceTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(questionnaireAssigned ? [{ key: "tasks" as WorkspaceTab, label: "Tasks" }] : []),
    { key: "messages", label: "Messages" },
    { key: "delivery", label: "Delivery" }
  ];

  return (
    <ClientShell portalExperience={portalExperience}>
      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-text-secondary">
          Loading project...
        </div>
      ) : pageError || !detail ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-6 text-white">
          {pageError ?? "Project unavailable"}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                {detail.project.client.name}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                {detail.project.name}
              </h1>
            </div>
            <span className={`text-sm font-medium ${projectStatusColor(detail.project.status)}`}>
              {projectStatusLabel(detail.project.status)}
            </span>
          </div>

          <nav className="flex gap-1 border-b border-[rgba(255,255,255,0.07)] pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-white text-white"
                    : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Status</p>
                  <p className={`mt-3 text-lg font-semibold ${projectStatusColor(detail.project.status)}`}>
                    {projectStatusLabel(detail.project.status)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    {isStandaloneQuote ? "Project type" : "Input progress"}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {isStandaloneQuote ? "Scoped project" : `${completedCount} of ${sessionNumbers.length} complete`}
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Hubs in scope</p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {detail.project.selectedHubs.length > 0 ? detail.project.selectedHubs.join(", ") : "—"}
                  </p>
                </div>
              </div>

              {portalQuoteEnabled ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Quote & approval</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        {quoteApprovalStatus === "approved"
                          ? "Quote approved"
                          : quoteApprovalStatus === "shared"
                            ? "Quote ready for your review"
                            : "Quote in preparation"}
                      </h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        {quoteApprovalStatus === "approved"
                          ? `Approved by ${quoteApprover}${quoteApprovedAt ? ` on ${quoteApprovedAt}` : ""}.`
                          : quoteApprovalStatus === "shared"
                            ? "Muloo has shared a quote with you. Review and approve it when you're ready."
                            : "Muloo is preparing your commercial scope. It will appear here once ready."}
                      </p>
                    </div>
                    {quoteApprovalStatus !== "draft" ? (
                      <Link
                        href={getPortalQuotePath(
                          portalExperience,
                          detail.project.id
                        )}
                        className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2.5 text-sm font-medium text-white"
                      >
                        {quoteApprovalStatus === "approved" ? "View quote" : "Review & approve"}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
                  <p className="text-sm font-medium text-white">Need to get in touch?</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Use the Messages tab to send a note or question to the Muloo team.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("messages")}
                    className="mt-3 text-sm font-medium text-[#51d0b0] hover:underline"
                  >
                    Go to messages →
                  </button>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5">
                  <p className="text-sm font-medium text-white">Delivery progress</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Track what's being built and the current status of each item.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("delivery")}
                    className="mt-3 text-sm font-medium text-[#51d0b0] hover:underline"
                  >
                    View delivery board →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "tasks" ? (
            <div className="space-y-5">
              {saveError ? (
                <div className="rounded-2xl border border-[rgba(224,80,96,0.35)] bg-background-card px-5 py-4 text-sm text-[#ffb1ba]">
                  {saveError}
                </div>
              ) : null}

              {isStandaloneQuote || !questionnaireAssigned ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <h3 className="text-lg font-semibold text-white">No input forms assigned</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    Muloo will surface specific input forms here when they need information from you. Nothing is required right now.
                  </p>
                </div>
              ) : (
                sessionNumbers.map((sessionNumber) => {
                  const definition = questionnaireDefinitions[sessionNumber];
                  if (!definition) return null;
                  const answers = drafts[sessionNumber] ?? {};
                  const status = statusForDraft(answers);
                  const saveState = sessionSaveState[sessionNumber];

                  return (
                    <section
                      key={sessionNumber}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                            Input {sessionNumber}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">{definition.title}</h3>
                          <p className="mt-2 text-sm text-text-secondary">{definition.description}</p>
                          <p className="mt-2 text-xs text-text-muted">Your progress saves automatically.</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium border ${
                          status === "Complete"
                            ? "text-[#51d0b0] border-[rgba(81,208,176,0.2)] bg-[rgba(81,208,176,0.08)]"
                            : status === "In progress"
                              ? "text-[#7be2ef] border-[rgba(123,226,239,0.18)] bg-[rgba(123,226,239,0.07)]"
                              : "text-text-muted border-white/10 bg-white/5"
                        }`}>
                          {status}
                        </span>
                      </div>

                      <div className="mt-6 grid gap-5 lg:grid-cols-2">
                        {definition.questions.map((question) => (
                          <label key={question.key} className="block">
                            <span className="text-sm font-medium text-white">{question.label}</span>
                            <span className="mt-1 block text-xs text-text-muted">{question.hint}</span>
                            <textarea
                              value={answers[question.key] ?? ""}
                              onChange={(e) => updateDraft(sessionNumber, question.key, e.target.value)}
                              onBlur={() => void saveSession(sessionNumber, { mode: "autosave" })}
                              className="mt-3 min-h-[140px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none resize-none"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className={`text-sm ${
                          saveState?.status === "error" ? "text-[#ff8f9c]"
                            : saveState?.status === "saved" ? "text-[#51d0b0]"
                              : "text-text-secondary"
                        }`}>
                          {saveState?.message ?? "Progress saves automatically."}
                        </p>
                        <button
                          type="button"
                          onClick={() => void saveSession(sessionNumber, { mode: "manual" })}
                          disabled={saveState?.status === "saving"}
                          className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {saveState?.status === "saving" ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          ) : null}

          {activeTab === "messages" ? (
            <div className="space-y-4">
              <div className="max-h-[480px] min-h-[200px] overflow-y-auto space-y-3 pr-1">
                {messages.length === 0 ? (
                  <div className="rounded-2xl bg-[#0b1126] border border-[rgba(255,255,255,0.07)] px-5 py-6 text-sm text-text-muted text-center">
                    No messages yet. Use the box below to send a note to the Muloo team.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isFromMuloo = msg.senderType === "internal";
                    const isOwnMessage = msg.senderType === "client";
                    return (
                      <div
                        key={msg.id}
                        className={`group rounded-2xl p-4 ${
                          isFromMuloo
                            ? "border border-[rgba(123,226,239,0.2)] bg-[#0b1733]"
                            : "border border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`text-xs font-semibold ${isFromMuloo ? "text-[#7be2ef]" : "text-text-muted"}`}>
                              {isFromMuloo ? "Muloo" : msg.senderName}
                            </span>
                            <span className="ml-2 text-xs text-text-muted">{formatTs(msg.createdAt)}</span>
                          </div>
                          {isOwnMessage ? (
                            <button
                              type="button"
                              onClick={() => void deleteMessage(msg.id)}
                              disabled={deletingMessageId === msg.id}
                              className="opacity-0 group-hover:opacity-100 text-xs text-text-muted hover:text-[#ff8f9c] transition-opacity disabled:opacity-40"
                            >
                              {deletingMessageId === msg.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-text-secondary whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    );
                  })
                )}
                <div ref={messagesBottomRef} />
              </div>

              {messageError ? <p className="text-xs text-[#ff8f9c]">{messageError}</p> : null}

              <div className="flex gap-3">
                <textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendMessage(); }}
                  placeholder="Write a message or question for the Muloo team... (Ctrl+Enter to send)"
                  rows={3}
                  className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={messageSending || !messageDraft.trim()}
                  className="self-end rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {messageSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === "delivery" ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Track the delivery plan and current progress for this project. Each item represents a piece of work that's been planned or completed.
              </p>
              <Link
                href={getPortalDeliveryPath(
                  portalExperience,
                  detail.project.id
                )}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-3 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.14)]"
              >
                Open full delivery board →
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </ClientShell>
  );
}
