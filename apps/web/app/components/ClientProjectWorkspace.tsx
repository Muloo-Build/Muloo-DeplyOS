"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface ClientMessage {
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

function ClientProjectMessages({ projectId, clientName }: { projectId: string; clientName: string }) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client/projects/${encodeURIComponent(projectId)}/messages`, { credentials: "include" });
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
      const res = await fetch(`/api/client/projects/${encodeURIComponent(projectId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: draft.trim(), senderName: clientName })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to send");
      setMessages((prev) => [...prev, body.message]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Messages</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">Project conversation</h3>
      <p className="mt-2 text-text-secondary">
        Leave notes or questions for the Muloo team here. We'll respond as soon as possible.
      </p>

      <div className="mt-6 max-h-[360px] overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="rounded-2xl bg-[#0b1126] px-5 py-4 text-sm text-text-muted">
            No messages yet. Use the box below to send a note or question to the Muloo team.
          </div>
        ) : (
          messages.map((msg) => {
            const isFromMuloo = msg.senderType === "internal";
            return (
              <div
                key={msg.id}
                className={`rounded-2xl p-4 ${isFromMuloo ? "border border-[rgba(123,226,239,0.2)] bg-[#0b1733]" : "border border-[rgba(255,255,255,0.07)] bg-[#0b1126]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${isFromMuloo ? "text-[#7be2ef]" : "text-text-muted"}`}>
                    {isFromMuloo ? "Muloo" : msg.senderName}
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

      {error ? <p className="mt-3 text-xs text-[#ff8f9c]">{error}</p> : null}

      <div className="mt-5 flex gap-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder="Write a message or question for the Muloo team... (Ctrl+Enter to send)"
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
    </section>
  );
}

import ClientShell from "./ClientShell";
import {
  clientSessionDefinitions,
  createDefaultClientQuestionnaireDefinitionMap,
  type ClientQuestionnaireDefinitionMap
} from "./clientQuestionnaire";

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

function createDrafts(
  submissions: ClientProjectDetail["submissions"],
  definitions: ClientQuestionnaireDefinitionMap
): Record<number, Record<string, string>> {
  return Object.keys(definitions).reduce<
    Record<number, Record<string, string>>
  >(
    (drafts, sessionNumberText) => {
      const sessionNumber = Number(sessionNumberText);
      const submission = submissions.find(
        (candidate) => candidate.sessionNumber === sessionNumber
      );
      const questions = definitions[sessionNumber]?.questions ?? [];

      drafts[sessionNumber] = Object.fromEntries(
        questions.map((question) => [
          question.key,
          submission?.answers?.[question.key] ?? ""
        ])
      );

      return drafts;
    },
    Object.fromEntries(
      Object.keys(definitions).map((sessionNumberText) => [
        Number(sessionNumberText),
        {}
      ])
    ) as Record<number, Record<string, string>>
  );
}

function statusForDraft(answers: Record<string, string>) {
  const values = Object.values(answers);

  if (
    values.length === 0 ||
    values.every((value) => value.trim().length === 0)
  ) {
    return "Not started";
  }

  if (values.every((value) => value.trim().length > 0)) {
    return "Complete";
  }

  return "In progress";
}

function createSessionSaveStateMap(
  submissions: ClientProjectDetail["submissions"]
): Record<number, SessionSaveState> {
  return submissions.reduce<Record<number, SessionSaveState>>(
    (state, submission) => {
      state[submission.sessionNumber] = {
        status: "saved",
        message: formatTimestamp(submission.updatedAt)
          ? `Saved ${formatTimestamp(submission.updatedAt)}`
          : "Saved"
      };
      return state;
    },
    {}
  );
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return timestamp.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default function ClientProjectWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [questionnaireDefinitions, setQuestionnaireDefinitions] =
    useState<ClientQuestionnaireDefinitionMap>(
      createDefaultClientQuestionnaireDefinitionMap()
    );
  const [detail, setDetail] = useState<ClientProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({
    1: {},
    2: {},
    3: {},
    4: {}
  });
  const [sessionSaveState, setSessionSaveState] = useState<
    Record<number, SessionSaveState>
  >({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const draftsRef = useRef(drafts);
  const autosaveTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout> | undefined>
  >({});
  const dirtySessionsRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(
          `/api/client/projects/${encodeURIComponent(projectId)}`,
          {
            credentials: "include"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load client project");
        }

        const body = await response.json();
        const nextDefinitions =
          body.project?.clientQuestionnaireConfig ?? clientSessionDefinitions;
        setDetail(body);
        setQuestionnaireDefinitions(nextDefinitions);
        setDrafts(createDrafts(body.submissions ?? [], nextDefinitions));
        setSessionSaveState(createSessionSaveStateMap(body.submissions ?? []));
        dirtySessionsRef.current = {};
      } catch (loadError) {
        setPageError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load client project"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const sessionNumbers = useMemo(
    () =>
      Object.keys(questionnaireDefinitions)
        .map((sessionNumberText) => Number(sessionNumberText))
        .filter((sessionNumber) => Number.isFinite(sessionNumber))
        .sort((left, right) => left - right),
    [questionnaireDefinitions]
  );
  const completedCount = useMemo(
    () =>
      Object.values(drafts).filter(
        (answers) => statusForDraft(answers) === "Complete"
      ).length,
    [drafts]
  );
  const totalInputSections = sessionNumbers.length;
  const isStandaloneQuote = detail?.project.scopeType === "standalone_quote";
  const questionnaireAssigned =
    !isStandaloneQuote && detail?.canCompleteQuestionnaire !== false;
  const quoteApprovalStatus = detail?.project.quoteApprovalStatus ?? "draft";
  const quoteSharedAt = formatTimestamp(detail?.project.quoteSharedAt);
  const quoteApprovedAt = formatTimestamp(detail?.project.quoteApprovedAt);
  const quoteApprover =
    detail?.project.quoteApprovedByName ||
    detail?.project.quoteApprovedByEmail ||
    "client team";

  function clearAutosaveTimer(sessionNumber: number) {
    const existingTimer = autosaveTimersRef.current[sessionNumber];

    if (existingTimer) {
      clearTimeout(existingTimer);
      delete autosaveTimersRef.current[sessionNumber];
    }
  }

  function markSessionPending(sessionNumber: number) {
    setSessionSaveState((currentState) => ({
      ...currentState,
      [sessionNumber]: {
        status: "pending",
        message: "Saving automatically..."
      }
    }));
  }

  function updateDraft(sessionNumber: number, fieldKey: string, value: string) {
    setDrafts((currentDrafts) => {
      const nextAnswers = {
        ...currentDrafts[sessionNumber],
        [fieldKey]: value
      };
      const nextDrafts = {
        ...currentDrafts,
        [sessionNumber]: nextAnswers
      };

      draftsRef.current = nextDrafts;
      dirtySessionsRef.current[sessionNumber] = true;
      clearAutosaveTimer(sessionNumber);
      markSessionPending(sessionNumber);
      autosaveTimersRef.current[sessionNumber] = setTimeout(() => {
        void saveSession(sessionNumber, {
          mode: "autosave",
          answersOverride: nextAnswers
        });
      }, 1200);

      return nextDrafts;
    });
  }

  async function saveSession(
    sessionNumber: number,
    options?: {
      mode?: "manual" | "autosave";
      answersOverride?: Record<string, string>;
    }
  ) {
    const mode = options?.mode ?? "manual";
    const answers =
      options?.answersOverride ?? draftsRef.current[sessionNumber] ?? {};

    clearAutosaveTimer(sessionNumber);
    setSaveError(null);
    setSessionSaveState((currentState) => ({
      ...currentState,
      [sessionNumber]: {
        status: "saving",
        message: mode === "manual" ? "Saving now..." : "Saving automatically..."
      }
    }));

    try {
      const response = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/submissions/${sessionNumber}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            answers
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save session");
      }

      setDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              submissions: [
                ...currentDetail.submissions.filter(
                  (submission) => submission.sessionNumber !== sessionNumber
                ),
                body.submission
              ].sort((left, right) => left.sessionNumber - right.sessionNumber)
            }
          : currentDetail
      );
      draftsRef.current = {
        ...draftsRef.current,
        [sessionNumber]: answers
      };
      dirtySessionsRef.current[sessionNumber] = false;
      setSessionSaveState((currentState) => ({
        ...currentState,
        [sessionNumber]: {
          status: "saved",
          message: body?.submission?.updatedAt
            ? `Saved ${formatTimestamp(body.submission.updatedAt)}`
            : mode === "manual"
              ? "Saved"
              : "Saved automatically"
        }
      }));
    } catch (saveError) {
      dirtySessionsRef.current[sessionNumber] = true;
      setSaveError(
        saveError instanceof Error ? saveError.message : "Failed to save inputs"
      );
      setSessionSaveState((currentState) => ({
        ...currentState,
        [sessionNumber]: {
          status: "error",
          message: "Could not save yet. Your latest edits are still on screen."
        }
      }));
    }
  }

  useEffect(() => {
    if (!questionnaireAssigned) {
      return undefined;
    }

    function flushPendingDrafts() {
      for (const [sessionNumberText, isDirty] of Object.entries(
        dirtySessionsRef.current
      )) {
        if (!isDirty) {
          continue;
        }

        const sessionNumber = Number(sessionNumberText);
        const answers = draftsRef.current[sessionNumber];

        if (!answers) {
          continue;
        }

        clearAutosaveTimer(sessionNumber);

        void fetch(
          `/api/client/projects/${encodeURIComponent(projectId)}/submissions/${sessionNumber}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            keepalive: true,
            body: JSON.stringify({ answers })
          }
        ).catch(() => null);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        flushPendingDrafts();
      }
    }

    window.addEventListener("beforeunload", flushPendingDrafts);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushPendingDrafts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      for (const sessionNumberText of Object.keys(autosaveTimersRef.current)) {
        clearAutosaveTimer(Number(sessionNumberText));
      }
    };
  }, [projectId, questionnaireAssigned]);

  return (
    <ClientShell title={detail?.project.name ?? "Project"}>
      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading project...
        </div>
      ) : pageError || !detail ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-6 text-white">
          {pageError ?? "Project unavailable"}
        </div>
      ) : (
        <div className="space-y-6">
          {saveError ? (
            <div className="rounded-2xl border border-[rgba(224,80,96,0.35)] bg-background-card px-5 py-4 text-sm text-[#ffb1ba]">
              {saveError}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            {quoteApprovalStatus === "draft" ? (
              <button
                type="button"
                disabled
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-text-muted"
              >
                Quote Coming Soon
              </button>
            ) : (
              <Link
                href={`/client/projects/${detail.project.id}/quote`}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
              >
                Open Quote
              </Link>
            )}
            <Link
              href={`/client/projects/${detail.project.id}/delivery`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Open Delivery Board
            </Link>
            {isStandaloneQuote ? null : (
              <Link
                href={`/client/projects/${detail.project.id}`}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
              >
                Project Inputs
              </Link>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                Project
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                {detail.project.name}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                {detail.project.scopeType === "standalone_quote"
                  ? "Project Type"
                  : "Input Sections Complete"}
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                {detail.project.scopeType === "standalone_quote"
                  ? "Scoped project"
                  : `${completedCount}/${totalInputSections}`}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                Hubs In Scope
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                {detail.project.selectedHubs.join(", ")}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Quote & Approval
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {quoteApprovalStatus === "approved"
                    ? "Approved commercial scope"
                    : quoteApprovalStatus === "shared"
                      ? "Quote ready for review"
                      : "Quote in preparation"}
                </h3>
                <p className="mt-3 max-w-3xl text-text-secondary">
                  {quoteApprovalStatus === "approved"
                    ? "This quote has been approved in the client portal. The agreed scope is now locked as the delivery baseline, and any additions should move through change management."
                    : quoteApprovalStatus === "shared"
                      ? "Muloo has pushed the latest quote into your portal. Review the scope, pricing, and approval pack, then approve it when you are ready."
                      : "Muloo is still preparing the commercial scope pack. Once it is pushed here, your team will be able to review and approve it from the portal."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {quoteApprovalStatus === "draft" ? (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-text-muted"
                  >
                    Awaiting Quote
                  </button>
                ) : (
                  <Link
                    href={`/client/projects/${detail.project.id}/quote`}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                  >
                    {quoteApprovalStatus === "approved"
                      ? "Open Approved Quote"
                      : "Review & Approve Quote"}
                  </Link>
                )}
                <Link
                  href={`/client/projects/${detail.project.id}/delivery`}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  Open Delivery Board
                </Link>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-[#0b1126] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Quote Status
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {quoteApprovalStatus === "approved"
                    ? "Approved"
                    : quoteApprovalStatus === "shared"
                      ? "Shared for review"
                      : "In preparation"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0b1126] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Shared To Portal
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {quoteSharedAt ?? "Not published yet"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0b1126] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Approval
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {quoteApprovalStatus === "approved"
                    ? `${quoteApprover}${quoteApprovedAt ? ` on ${quoteApprovedAt}` : ""}`
                    : quoteApprovalStatus === "shared"
                      ? "Pending client sign-off"
                      : "Waiting for quote publication"}
                </p>
              </div>
            </div>
          </section>

          {isStandaloneQuote || !questionnaireAssigned ? (
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                Client workspace
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                {isStandaloneQuote
                  ? "No project inputs assigned right now"
                  : "Project input access is not assigned for this contact"}
              </h3>
              <p className="mt-3 max-w-3xl text-text-secondary">
                {isStandaloneQuote
                  ? "This project is running as a scoped job, so there are no standard client inputs to complete right now. Use this workspace to review the project, track delivery, and access any documents or approvals Muloo shares with you."
                  : "This portal contact has visibility into the project, but Muloo has not assigned the active project inputs to them. Use this workspace to review updates, documents, and approvals while the assigned contributors complete the required inputs."}
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#0b1126] p-5">
                  <p className="text-sm font-semibold text-white">
                    What you can do here
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                    <li>Review the project scope and delivery plan</li>
                    <li>Track progress on the delivery board</li>
                    <li>Review shared documents and approvals when provided</li>
                  </ul>
                </div>
                <div className="rounded-2xl bg-[#0b1126] p-5">
                  <p className="text-sm font-semibold text-white">
                    If Muloo needs client input
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    We’ll surface a specific input pack or request here only
                    when information is required from your team for this
                    project.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            sessionNumbers.map((sessionNumber) => {
              const definition = questionnaireDefinitions[sessionNumber];
              if (!definition) {
                return null;
              }
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
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Input Section {sessionNumber}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">
                        {definition.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-text-secondary">
                        {definition.description}
                      </p>
                      <p className="mt-3 text-sm text-text-muted">
                        Your progress saves automatically as you work, so you
                        can leave and come back later.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3 text-sm text-white">
                      {status}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {definition.questions.map((question) => (
                      <label key={question.key} className="block">
                        <span className="text-sm font-medium text-white">
                          {question.label}
                        </span>
                        <span className="mt-1 block text-xs text-text-muted">
                          {question.hint}
                        </span>
                        <textarea
                          value={answers[question.key] ?? ""}
                          onChange={(event) =>
                            updateDraft(
                              sessionNumber,
                              question.key,
                              event.target.value
                            )
                          }
                          onBlur={() =>
                            void saveSession(sessionNumber, {
                              mode: "autosave"
                            })
                          }
                          className="mt-3 min-h-[150px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p
                      className={`text-sm ${
                        saveState?.status === "error"
                          ? "text-[#ff8f9c]"
                          : saveState?.status === "saved"
                            ? "text-[#51d0b0]"
                            : "text-text-secondary"
                      }`}
                    >
                      {saveState?.message ?? "Progress saves automatically."}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void saveSession(sessionNumber, {
                          mode: "manual"
                        })
                      }
                      disabled={saveState?.status === "saving"}
                      className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saveState?.status === "saving"
                        ? "Saving..."
                        : "Save Now"}
                    </button>
                  </div>
                </section>
              );
            })
          )}

          <ClientProjectMessages
            projectId={detail.project.id}
            clientName={`${detail.user.firstName} ${detail.user.lastName}`}
          />
        </div>
      )}
    </ClientShell>
  );
}
