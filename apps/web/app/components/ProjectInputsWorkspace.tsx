"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import ProjectWorkflowNav from "./ProjectWorkflowNav";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import {
  createDefaultClientQuestionnaireDefinitionMap,
  type ClientQuestionnaireDefinitionMap
} from "./clientQuestionnaire";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  scopeLockedAt?: string | null;
  scopeType?: string | null;
  selectedHubs: string[];
  clientQuestionnaireConfig?: ClientQuestionnaireDefinitionMap | null;
  client: {
    name: string;
  };
}

interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  authStatus: string;
  questionnaireAccess?: boolean;
  assignedInputSections?: number[];
  canApproveQuotes?: boolean;
}

interface ClientUserAssignmentDraft {
  questionnaireAccess: boolean;
  assignedInputSections: number[];
}

interface ProjectSubmissionRecord {
  id: string;
  sessionNumber: number;
  status: string;
  answers: Record<string, string>;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

function cloneQuestionnaireDefinitions(
  value?: ClientQuestionnaireDefinitionMap | null
): ClientQuestionnaireDefinitionMap {
  return JSON.parse(
    JSON.stringify(value ?? createDefaultClientQuestionnaireDefinitionMap())
  ) as ClientQuestionnaireDefinitionMap;
}

function createQuestionKey(label: string, fallbackIndex: number) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `custom_question_${fallbackIndex}`;
}

function normalizeSessionNumbers(value: ClientQuestionnaireDefinitionMap) {
  return Object.keys(value)
    .map((sessionNumberText) => Number(sessionNumberText))
    .filter((sessionNumber) => Number.isFinite(sessionNumber))
    .sort((left, right) => left - right);
}

function getEnabledSessionNumbers(value: ClientQuestionnaireDefinitionMap) {
  return normalizeSessionNumbers(value).filter((sessionNumber) => {
    const session = value[sessionNumber];
    return (
      session &&
      session.enabled !== false &&
      session.questions.some((question) => question.enabled !== false)
    );
  });
}

function formatAnswerValue(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return "No answer yet";
  }

  return value;
}

export default function ProjectInputsWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [questionnaireDraft, setQuestionnaireDraft] =
    useState<ClientQuestionnaireDefinitionMap>(
      createDefaultClientQuestionnaireDefinitionMap()
    );
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [submissions, setSubmissions] = useState<ProjectSubmissionRecord[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, ClientUserAssignmentDraft>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(
    null
  );

  async function loadWorkspace() {
    setLoading(true);
    setError(null);

    try {
      const [projectResponse, clientUsersResponse, submissionsResponse] =
        await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/client-users`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/client-input-submissions`)
        ]);

      if (!projectResponse.ok) {
        throw new Error("Failed to load project");
      }

      if (!clientUsersResponse.ok) {
        throw new Error("Failed to load project contacts");
      }

      if (!submissionsResponse.ok) {
        throw new Error("Failed to load saved client inputs");
      }

      const [projectBody, clientUsersBody, submissionsBody] = await Promise.all([
        projectResponse.json(),
        clientUsersResponse.json(),
        submissionsResponse.json()
      ]);
      const nextProject = projectBody.project as ProjectDetail;
      const nextQuestionnaireDraft = cloneQuestionnaireDefinitions(
        nextProject.clientQuestionnaireConfig
      );
      const enabledSections = getEnabledSessionNumbers(nextQuestionnaireDraft);
      const nextClientUsers = (clientUsersBody.clientUsers ??
        []) as ClientUser[];

      setProject(nextProject);
      setQuestionnaireDraft(nextQuestionnaireDraft);
      setClientUsers(nextClientUsers);
      setSubmissions((submissionsBody.submissions ?? []) as ProjectSubmissionRecord[]);
      setAssignmentDrafts(
        Object.fromEntries(
          nextClientUsers.map((clientUser) => [
            clientUser.id,
            {
              questionnaireAccess: clientUser.questionnaireAccess !== false,
              assignedInputSections:
                clientUser.questionnaireAccess === false
                  ? []
                  : clientUser.assignedInputSections?.length
                    ? clientUser.assignedInputSections
                    : enabledSections
            }
          ])
        )
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load project inputs"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [projectId]);

  const sessionNumbers = useMemo(
    () => normalizeSessionNumbers(questionnaireDraft),
    [questionnaireDraft]
  );
  const enabledSessionNumbers = useMemo(
    () => getEnabledSessionNumbers(questionnaireDraft),
    [questionnaireDraft]
  );
  const isScopeLocked = Boolean(project?.scopeLockedAt);

  function updateSession(
    sessionNumber: number,
    field: "title" | "description" | "enabled",
    value: string | boolean
  ) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        [field]: value
      }
    }));
  }

  function updateQuestion(
    sessionNumber: number,
    questionIndex: number,
    field: "label" | "hint" | "enabled",
    value: string | boolean
  ) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        questions: currentDraft[sessionNumber].questions.map(
          (question, index) =>
            index === questionIndex ? { ...question, [field]: value } : question
        )
      }
    }));
  }

  function addQuestion(sessionNumber: number) {
    setQuestionnaireDraft((currentDraft) => {
      const session = currentDraft[sessionNumber];
      const nextIndex = session.questions.length + 1;

      return {
        ...currentDraft,
        [sessionNumber]: {
          ...session,
          questions: [
            ...session.questions,
            {
              key: `custom_question_${nextIndex}`,
              label: "",
              hint: "",
              enabled: true
            }
          ]
        }
      };
    });
  }

  function removeQuestion(sessionNumber: number, questionIndex: number) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        questions: currentDraft[sessionNumber].questions.filter(
          (_question, index) => index !== questionIndex
        )
      }
    }));
  }

  async function saveQuestionnaireConfig() {
    if (!project) {
      return;
    }

    setSavingConfig(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = cloneQuestionnaireDefinitions(questionnaireDraft);

      for (const sessionNumber of sessionNumbers) {
        const session = payload[sessionNumber];
        session.questions = session.questions.map((question, index) => ({
          ...question,
          key:
            question.key.trim() || createQuestionKey(question.label, index + 1),
          enabled: question.enabled !== false
        }));
        session.enabled = session.enabled !== false;
      }

      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientQuestionnaireConfig: payload
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save project inputs");
      }

      setProject(body.project);
      setQuestionnaireDraft(
        cloneQuestionnaireDefinitions(body.project.clientQuestionnaireConfig)
      );
      setFeedback("Project input pack saved.");

      const nextEnabledSections = getEnabledSessionNumbers(payload);
      setAssignmentDrafts((currentDrafts) =>
        Object.fromEntries(
          Object.entries(currentDrafts).map(([userId, draft]) => [
            userId,
            {
              ...draft,
              assignedInputSections: draft.questionnaireAccess
                ? draft.assignedInputSections.filter((section) =>
                    nextEnabledSections.includes(section)
                  )
                : []
            }
          ])
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save project inputs"
      );
    } finally {
      setSavingConfig(false);
    }
  }

  function updateAssignmentDraft(
    userId: string,
    updater: (draft: ClientUserAssignmentDraft) => ClientUserAssignmentDraft
  ) {
    setAssignmentDrafts((currentDrafts) => {
      const currentDraft =
        currentDrafts[userId] ??
        ({
          questionnaireAccess: true,
          assignedInputSections: enabledSessionNumbers
        } satisfies ClientUserAssignmentDraft);

      return {
        ...currentDrafts,
        [userId]: updater(currentDraft)
      };
    });
  }

  async function saveAssignment(user: ClientUser) {
    const draft = assignmentDrafts[user.id];

    if (!draft) {
      return;
    }

    setSavingAssignmentId(user.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/client-users/${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionnaireAccess: draft.questionnaireAccess,
            assignedInputSections: draft.questionnaireAccess
              ? draft.assignedInputSections
              : []
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save input assignment");
      }

      setClientUsers((currentUsers) =>
        currentUsers.map((clientUser) =>
          clientUser.id === user.id
            ? { ...clientUser, ...body.clientUser }
            : clientUser
        )
      );
      setAssignmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [user.id]: {
          questionnaireAccess: body.clientUser.questionnaireAccess !== false,
          assignedInputSections: body.clientUser.assignedInputSections ?? []
        }
      }));
      setFeedback(
        `${user.firstName || user.email} now has the right project input assignment.`
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save input assignment"
      );
    } finally {
      setSavingAssignmentId(null);
    }
  }

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <div className="space-y-6">
          {loading ? (
            <Empty title="Loading project inputs…" sub="One moment." />
          ) : error && !project ? (
            <Empty title="Inputs error" sub={error} />
          ) : project ? (
            <>
              <PageHead
                eyebrow={
                  <Link
                    href={`/projects/${project.id}`}
                    className="hover:text-text-1 transition-colors"
                  >
                    ← Project workspace
                  </Link>
                }
                title={`Inputs — ${project.name}`}
                lede="Build the exact client input pack for this project. Assign sections to the people who should answer them. This is where we make the discovery flow fit the real job, not a generic template."
                actions={
                  <Link href={`/projects/${project.id}`}>
                    <Btn variant="ghost" size="md">
                      Back to summary
                    </Btn>
                  </Link>
                }
              />
              <ProjectWorkflowNav projectId={projectId} showDiscovery />
              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
                <div className="hidden">
                  <p>removed-legacy-header</p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Client", value: project.client.name },
                    {
                      label: "Hubs",
                      value: project.selectedHubs.join(", ") || "None set"
                    },
                    {
                      label: "Enabled Sections",
                      value: `${enabledSessionNumbers.length}/${sessionNumbers.length}`
                    },
                    {
                      label: "Portal Contributors",
                      value: String(
                        clientUsers.filter(
                          (user) => user.questionnaireAccess !== false
                        ).length
                      )
                    }
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[14px] bg-ink-2 px-5 py-5"
                    >
                      <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                        {item.label}
                      </p>
                      <p className="mt-3 text-lg font-semibold text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {error ? (
                <div className="rounded-[14px] border border-[rgba(224,80,96,0.35)] bg-ink-1 px-5 py-4 text-sm text-[#ffb1ba]">
                  {error}
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-[14px] border border-[rgba(81,208,176,0.25)] bg-ink-1 px-5 py-4 text-sm text-[#51d0b0]">
                  {feedback}
                </div>
              ) : null}

              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Saved Client Answers
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-text-2">
                      This is the information your client team has already given
                      us in the portal. It stays here so nobody has to retype
                      good answers just because the project evolved.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {submissions.length > 0 ? (
                    submissions.map((submission) => {
                      const session =
                        questionnaireDraft[submission.sessionNumber];
                      const answeredEntries = Object.entries(
                        submission.answers ?? {}
                      ).filter(([, value]) => value.trim().length > 0);

                      return (
                        <div
                          key={submission.id}
                          className="rounded-[14px] border border-ink-4 bg-ink-2 p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                                Input Section {submission.sessionNumber}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-white">
                                {session?.title ??
                                  `Session ${submission.sessionNumber}`}
                              </p>
                              <p className="mt-1 text-sm text-text-2">
                                {[
                                  submission.user.firstName,
                                  submission.user.lastName
                                ]
                                  .filter(Boolean)
                                  .join(" ") || submission.user.email}{" "}
                                · {new Date(submission.updatedAt).toLocaleString("en-ZA")}
                              </p>
                            </div>
                            <div className="rounded-full border border-ink-4 px-3 py-1 text-xs uppercase tracking-[0.16em] text-text-3">
                              {submission.status}
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            {(session?.questions ?? []).map((question) => (
                              <div
                                key={`${submission.id}-${question.key}`}
                                className="rounded-[14px] border border-ink-4 bg-ink-1 p-4"
                              >
                                <p className="text-sm font-medium text-white">
                                  {question.label}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-2">
                                  {formatAnswerValue(
                                    submission.answers?.[question.key]
                                  )}
                                </p>
                              </div>
                            ))}

                            {!session && answeredEntries.length > 0
                              ? answeredEntries.map(([key, value]) => (
                                  <div
                                    key={`${submission.id}-${key}`}
                                    className="rounded-[14px] border border-ink-4 bg-ink-1 p-4"
                                  >
                                    <p className="text-sm font-medium text-white">
                                      {key.replace(/_/g, " ")}
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-2">
                                      {formatAnswerValue(value)}
                                    </p>
                                  </div>
                                ))
                              : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-ink-4 px-5 py-5 text-sm text-text-2">
                      No client answers have been saved yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Input Pack Builder
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-text-2">
                      Turn sections on or off, refine the questions, and add
                      one-off prompts for this specific project. If a section is
                      disabled or all its questions are off, clients will not
                      see it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveQuestionnaireConfig()}
                    disabled={savingConfig || isScopeLocked}
                    className="rounded-[14px] border border-ink-4 bg-ink-2 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-3"
                  >
                    {savingConfig ? "Saving..." : "Save input pack"}
                  </button>
                </div>

                <div className="mt-6 space-y-5">
                  {sessionNumbers.map((sessionNumber) => {
                    const session = questionnaireDraft[sessionNumber];
                    if (!session) {
                      return null;
                    }

                    return (
                      <div
                        key={sessionNumber}
                        className="rounded-[14px] border border-ink-4 bg-ink-2 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                              Input Section {sessionNumber}
                            </p>
                            <input
                              value={session.title}
                              onChange={(event) =>
                                updateSession(
                                  sessionNumber,
                                  "title",
                                  event.target.value
                                )
                              }
                              className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-lg font-semibold text-white outline-none"
                            />
                            <textarea
                              value={session.description}
                              onChange={(event) =>
                                updateSession(
                                  sessionNumber,
                                  "description",
                                  event.target.value
                                )
                              }
                              className="mt-3 min-h-[92px] w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
                            />
                          </div>
                          <label className="flex items-center gap-3 rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white">
                            <input
                              type="checkbox"
                              checked={session.enabled !== false}
                              onChange={(event) =>
                                updateSession(
                                  sessionNumber,
                                  "enabled",
                                  event.target.checked
                                )
                              }
                            />
                            Use this section
                          </label>
                        </div>

                        <div className="mt-5 space-y-3">
                          {session.questions.map((question, questionIndex) => (
                            <div
                              key={`${sessionNumber}-${question.key}-${questionIndex}`}
                              className="rounded-[14px] border border-ink-4 bg-ink-1 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-3">
                                  <input
                                    value={question.label}
                                    onChange={(event) =>
                                      updateQuestion(
                                        sessionNumber,
                                        questionIndex,
                                        "label",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Question label"
                                    className="w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm font-medium text-white outline-none"
                                  />
                                  <textarea
                                    value={question.hint}
                                    onChange={(event) =>
                                      updateQuestion(
                                        sessionNumber,
                                        questionIndex,
                                        "hint",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Help text or context for the client"
                                    className="min-h-[84px] w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-2 rounded-xl border border-ink-4 px-3 py-2 text-xs font-medium text-white">
                                    <input
                                      type="checkbox"
                                      checked={question.enabled !== false}
                                      onChange={(event) =>
                                        updateQuestion(
                                          sessionNumber,
                                          questionIndex,
                                          "enabled",
                                          event.target.checked
                                        )
                                      }
                                    />
                                    Use question
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeQuestion(
                                        sessionNumber,
                                        questionIndex
                                      )
                                    }
                                    className="rounded-xl border border-[rgba(255,143,156,0.22)] bg-[rgba(255,143,156,0.08)] px-3 py-2 text-xs font-medium text-[#ffb1ba]"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => addQuestion(sessionNumber)}
                            className="rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm font-medium text-white"
                          >
                            Add ad hoc question
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Per-Contact Assignment
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-text-2">
                      Decide who should answer what. A client contact can stay
                      visibility-only, or be assigned only the sections relevant
                      to them. This keeps executive stakeholders out of
                      operational questions and gives each person a cleaner
                      portal experience.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {clientUsers.length > 0 ? (
                    clientUsers.map((clientUser) => {
                      const assignmentDraft =
                        assignmentDrafts[clientUser.id] ??
                        ({
                          questionnaireAccess:
                            clientUser.questionnaireAccess !== false,
                          assignedInputSections:
                            clientUser.assignedInputSections ??
                            enabledSessionNumbers
                        } satisfies ClientUserAssignmentDraft);

                      return (
                        <div
                          key={clientUser.id}
                          className="rounded-[14px] border border-ink-4 bg-ink-2 p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold text-white">
                                {[clientUser.firstName, clientUser.lastName]
                                  .filter(Boolean)
                                  .join(" ") || clientUser.email}
                              </p>
                              <p className="mt-1 text-sm text-text-2">
                                {clientUser.email} · {clientUser.role} ·{" "}
                                {clientUser.authStatus === "active"
                                  ? "Portal active"
                                  : "Invite pending"}
                              </p>
                            </div>
                            <label className="flex items-center gap-3 rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white">
                              <input
                                type="checkbox"
                                checked={assignmentDraft.questionnaireAccess}
                                onChange={(event) =>
                                  updateAssignmentDraft(
                                    clientUser.id,
                                    (currentDraft) => ({
                                      ...currentDraft,
                                      questionnaireAccess: event.target.checked,
                                      assignedInputSections: event.target
                                        .checked
                                        ? currentDraft.assignedInputSections
                                            .length > 0
                                          ? currentDraft.assignedInputSections.filter(
                                              (section) =>
                                                enabledSessionNumbers.includes(
                                                  section
                                                )
                                            )
                                          : enabledSessionNumbers
                                        : []
                                    })
                                  )
                                }
                              />
                              This contact answers project inputs
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {enabledSessionNumbers.map((sessionNumber) => {
                              const session = questionnaireDraft[sessionNumber];
                              if (!session) {
                                return null;
                              }

                              return (
                                <label
                                  key={`${clientUser.id}-${sessionNumber}`}
                                  className={`flex items-start gap-3 rounded-[14px] border px-4 py-4 text-sm ${
                                    assignmentDraft.questionnaireAccess
                                      ? "border-ink-4 bg-ink-1 text-white"
                                      : "border-[rgba(255,255,255,0.05)] bg-ink-1 text-text-3 opacity-60"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={assignmentDraft.assignedInputSections.includes(
                                      sessionNumber
                                    )}
                                    disabled={
                                      !assignmentDraft.questionnaireAccess
                                    }
                                    onChange={(event) =>
                                      updateAssignmentDraft(
                                        clientUser.id,
                                        (currentDraft) => ({
                                          ...currentDraft,
                                          assignedInputSections: event.target
                                            .checked
                                            ? Array.from(
                                                new Set([
                                                  ...currentDraft.assignedInputSections,
                                                  sessionNumber
                                                ])
                                              ).sort(
                                                (left, right) => left - right
                                              )
                                            : currentDraft.assignedInputSections.filter(
                                                (section) =>
                                                  section !== sessionNumber
                                              )
                                        })
                                      )
                                    }
                                    className="mt-1"
                                  />
                                  <div>
                                    <p className="font-medium">
                                      {session.title}
                                    </p>
                                    <p className="mt-1 text-xs text-text-2">
                                      {
                                        session.questions.filter(
                                          (question) =>
                                            question.enabled !== false
                                        ).length
                                      }{" "}
                                      active questions
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-text-2">
                              {assignmentDraft.questionnaireAccess
                                ? `${assignmentDraft.assignedInputSections.length} section${
                                    assignmentDraft.assignedInputSections
                                      .length === 1
                                      ? ""
                                      : "s"
                                  } assigned`
                                : "Visibility only"}
                            </p>
                            <button
                              type="button"
                              onClick={() => void saveAssignment(clientUser)}
                              disabled={
                                savingAssignmentId === clientUser.id ||
                                (assignmentDraft.questionnaireAccess &&
                                  assignmentDraft.assignedInputSections
                                    .length === 0)
                              }
                              className="rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-3"
                            >
                              {savingAssignmentId === clientUser.id
                                ? "Saving..."
                                : "Save assignment"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-ink-4 px-5 py-5 text-sm text-text-2">
                      Add client portal users first, then assign sections here.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
