"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ClientShell from "./ClientShell";
import { clientSessionDefinitions } from "./clientQuestionnaire";

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
  }>;
}

function createDrafts(
  submissions: ClientProjectDetail["submissions"]
): Record<number, Record<string, string>> {
  return [1, 2, 3, 4].reduce<Record<number, Record<string, string>>>(
    (drafts, sessionNumber) => {
      const submission = submissions.find(
        (candidate) => candidate.sessionNumber === sessionNumber
      );
      const questions = clientSessionDefinitions[sessionNumber]?.questions ?? [];

      drafts[sessionNumber] = Object.fromEntries(
        questions.map((question) => [question.key, submission?.answers?.[question.key] ?? ""])
      );

      return drafts;
    },
    { 1: {}, 2: {}, 3: {}, 4: {} }
  );
}

function statusForDraft(answers: Record<string, string>) {
  const values = Object.values(answers);

  if (values.length === 0 || values.every((value) => value.trim().length === 0)) {
    return "Not started";
  }

  if (values.every((value) => value.trim().length > 0)) {
    return "Complete";
  }

  return "In progress";
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
  const [detail, setDetail] = useState<ClientProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({
    1: {},
    2: {},
    3: {},
    4: {}
  });
  const [savingSession, setSavingSession] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(`/api/client/projects/${encodeURIComponent(projectId)}`, {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Failed to load client project");
        }

        const body = await response.json();
        setDetail(body);
        setDrafts(createDrafts(body.submissions ?? []));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load client project"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  const completedCount = useMemo(
    () =>
      Object.values(drafts).filter((answers) => statusForDraft(answers) === "Complete")
        .length,
    [drafts]
  );
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

  function updateDraft(sessionNumber: number, fieldKey: string, value: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [sessionNumber]: {
        ...currentDrafts[sessionNumber],
        [fieldKey]: value
      }
    }));
  }

  async function saveSession(sessionNumber: number) {
    setSavingSession(sessionNumber);
    setError(null);

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
            answers: drafts[sessionNumber]
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
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save session"
      );
    } finally {
      setSavingSession(null);
    }
  }

  return (
    <ClientShell title={detail?.project.name ?? "Project"}>
      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading project...
        </div>
      ) : error || !detail ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-6 text-white">
          {error ?? "Project unavailable"}
        </div>
      ) : (
        <div className="space-y-6">
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
                Discovery Inputs
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
                  : "Discovery Sessions Complete"}
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                {detail.project.scopeType === "standalone_quote"
                  ? "Scoped project"
                  : `${completedCount}/4`}
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
                  ? "No questionnaire assigned right now"
                  : "Questionnaire access is not assigned for this contact"}
              </h3>
              <p className="mt-3 max-w-3xl text-text-secondary">
                {isStandaloneQuote
                  ? "This project is running as a scoped job, so there is no standard discovery form to complete right now. Use this workspace to review the project, track delivery, and access any documents or approvals Muloo shares with you."
                  : "This portal contact has visibility into the project, but Muloo has not assigned the discovery questionnaire to them. Use this workspace to review updates, documents, and approvals while the active questionnaire owners complete the required inputs."}
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
                    We’ll surface a specific form or request here only when information is required from your team for this project.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            Object.entries(clientSessionDefinitions).map(([sessionNumberText, definition]) => {
              const sessionNumber = Number(sessionNumberText);
              const answers = drafts[sessionNumber] ?? {};
              const status = statusForDraft(answers);

              return (
                <section
                  key={sessionNumber}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Session {sessionNumber}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">
                        {definition.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-text-secondary">
                        {definition.description}
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
                            updateDraft(sessionNumber, question.key, event.target.value)
                          }
                          className="mt-3 min-h-[150px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveSession(sessionNumber)}
                      disabled={savingSession === sessionNumber}
                      className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {savingSession === sessionNumber ? "Saving..." : "Save Session"}
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </ClientShell>
  );
}
