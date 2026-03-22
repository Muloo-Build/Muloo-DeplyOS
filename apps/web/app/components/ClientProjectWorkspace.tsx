"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ClientShell from "./ClientShell";

interface ClientProjectDetail {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  role: string;
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

const sessionDefinitions: Record<
  number,
  { title: string; description: string; questions: Array<{ key: string; label: string; hint: string }> }
> = {
  1: {
    title: "Business & Goals",
    description:
      "Help Muloo understand the business, why this project matters, and what success should look like.",
    questions: [
      {
        key: "business_overview",
        label: "Tell us about your business",
        hint: "What the business does, key services, and who you serve."
      },
      {
        key: "primary_pain_challenge",
        label: "What is the biggest challenge driving this project?",
        hint: "What is not working well enough today?"
      },
      {
        key: "goals_and_success_metrics",
        label: "What outcomes would make this project a success?",
        hint: "Think in terms of business results, team improvements, or customer outcomes."
      },
      {
        key: "key_stakeholders",
        label: "Who should be involved in decisions and delivery?",
        hint: "List the people, teams, or roles that matter."
      },
      {
        key: "timeline_and_constraints",
        label: "Are there key timing or business constraints?",
        hint: "Important deadlines, events, campaigns, resourcing, or dependencies."
      }
    ]
  },
  2: {
    title: "Current State",
    description:
      "Describe the systems, tools, data, and workflows you use today so discovery starts from reality.",
    questions: [
      {
        key: "current_tech_stack",
        label: "What tools and platforms do you use today?",
        hint: "CRM, email, forms, reporting, finance, website, or any other important tools."
      },
      {
        key: "current_hubspot_state",
        label: "What is your current HubSpot situation?",
        hint: "If you already use HubSpot, what is in place and what feels incomplete or broken?"
      },
      {
        key: "data_landscape",
        label: "Where does your key data live today?",
        hint: "Spreadsheets, legacy CRM, email lists, finance systems, or other sources."
      },
      {
        key: "current_processes",
        label: "How do your teams currently work?",
        hint: "Describe the current sales, marketing, service, or operational process."
      },
      {
        key: "what_has_been_tried_before",
        label: "What has already been tried?",
        hint: "Previous systems, projects, fixes, or workarounds."
      }
    ]
  },
  3: {
    title: "Future State Design",
    description:
      "Describe what you want the future way of working to look like so Muloo can shape the recommendation properly.",
    questions: [
      {
        key: "hubs_and_features_required",
        label: "Which hubs or capabilities matter most?",
        hint: "Sales, marketing, service, content, operations, automation, reporting, and so on."
      },
      {
        key: "pipeline_and_process_design",
        label: "How should the future process work?",
        hint: "What should happen from first enquiry through to delivery, renewal, or support?"
      },
      {
        key: "automation_requirements",
        label: "What should be automated?",
        hint: "Routing, notifications, qualification, reminders, handoffs, or customer journeys."
      },
      {
        key: "integration_requirements",
        label: "What other systems need to connect?",
        hint: "Finance, events, website, support, surveys, forms, or any other critical tools."
      },
      {
        key: "reporting_requirements",
        label: "What reporting or visibility is needed?",
        hint: "Dashboards, KPIs, board reporting, pipeline visibility, attribution, or service performance."
      }
    ]
  },
  4: {
    title: "Scope & Handover",
    description:
      "Help Muloo understand what should be prioritised, what is out of scope for now, and what the client team needs to provide.",
    questions: [
      {
        key: "confirmed_scope",
        label: "What do you see as the priority scope for this work?",
        hint: "The pieces that matter most to get right first."
      },
      {
        key: "out_of_scope",
        label: "What should not be part of this phase?",
        hint: "Anything that should be excluded, deferred, or treated separately."
      },
      {
        key: "risks_and_blockers",
        label: "What could delay or complicate delivery?",
        hint: "Access, data, resourcing, change resistance, approvals, or technical unknowns."
      },
      {
        key: "client_responsibilities",
        label: "What can your team provide or own?",
        hint: "Data, access, decisions, approvals, subject matter expertise, or internal project ownership."
      },
      {
        key: "agreed_next_steps",
        label: "What should happen next after discovery?",
        hint: "Actions, owners, and what you expect to receive back from Muloo."
      }
    ]
  }
};

function createDrafts(
  submissions: ClientProjectDetail["submissions"]
): Record<number, Record<string, string>> {
  return [1, 2, 3, 4].reduce<Record<number, Record<string, string>>>(
    (drafts, sessionNumber) => {
      const submission = submissions.find(
        (candidate) => candidate.sessionNumber === sessionNumber
      );
      const questions = sessionDefinitions[sessionNumber]?.questions ?? [];

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
            <Link
              href={`/client/projects/${detail.project.id}/quote`}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Open Quote
            </Link>
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
                  ? "Scope Mode"
                  : "Discovery Sessions Complete"}
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                {detail.project.scopeType === "standalone_quote"
                  ? "Standalone quote"
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
                <Link
                  href={`/client/projects/${detail.project.id}/quote`}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                >
                  {quoteApprovalStatus === "approved"
                    ? "Open Approved Quote"
                    : quoteApprovalStatus === "shared"
                      ? "Review & Approve Quote"
                      : "Open Quote"}
                </Link>
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
                      : "Not yet shared"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0b1126] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Shared To Portal
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {quoteSharedAt ?? "Waiting on Muloo"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0b1126] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Approval
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {quoteApprovalStatus === "approved"
                    ? `${quoteApprover}${quoteApprovedAt ? ` on ${quoteApprovedAt}` : ""}`
                    : "Pending client sign-off"}
                </p>
              </div>
            </div>
          </section>

          {isStandaloneQuote ? (
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                Client workspace
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                No client questionnaire assigned
              </h3>
              <p className="mt-3 max-w-3xl text-text-secondary">
                This project is running as a standalone scoped job, so there is no standard discovery form to complete. Use this workspace to review the project, track delivery, and access any documents or approvals Muloo shares with you.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#0b1126] p-5">
                  <p className="text-sm font-semibold text-white">
                    What you can do here
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                    <li>Review the scoped work and delivery plan</li>
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
            Object.entries(sessionDefinitions).map(([sessionNumberText, definition]) => {
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
