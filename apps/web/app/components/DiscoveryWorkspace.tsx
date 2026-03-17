"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  engagementType: string;
  client: {
    name: string;
  };
  selectedHubs: string[];
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface SessionFieldDefinition {
  key: string;
  label: string;
  hint: string;
  input?: "textarea" | "select";
  options?: Array<{
    value: string;
    label: string;
  }>;
}

const sessionDefinitions: Record<
  number,
  {
    description: string;
    fields: SessionFieldDefinition[];
  }
> = {
  1: {
    description:
      "Capture the business context, commercial drivers, success metrics, and timeline constraints.",
    fields: [
      {
        key: "business_overview",
        label: "Business Overview",
        hint: "Industry, team size, what the business does"
      },
      {
        key: "primary_pain_challenge",
        label: "Primary Pain / Challenge",
        hint: "What problem is driving this engagement?"
      },
      {
        key: "goals_and_success_metrics",
        label: "Goals & Success Metrics",
        hint: "What does success look like in 60-90 days?"
      },
      {
        key: "key_stakeholders",
        label: "Key Stakeholders",
        hint: "Who are the decision makers and project owners?"
      },
      {
        key: "timeline_and_constraints",
        label: "Timeline & Constraints",
        hint: "Target go-live, budget constraints, dependencies"
      }
    ]
  },
  2: {
    description:
      "Audit the current systems, data landscape, and the way the team operates today.",
    fields: [
      {
        key: "current_tech_stack",
        label: "Current Tech Stack",
        hint: "CRM, email tools, integrations, data sources"
      },
      {
        key: "current_hubspot_state",
        label: "Current HubSpot State",
        hint: "What exists today? What is broken or missing?"
      },
      {
        key: "data_landscape",
        label: "Data Landscape",
        hint: "Where does data live? Volume, quality, sources"
      },
      {
        key: "current_processes",
        label: "Current Processes",
        hint: "Walk through the current sales or marketing process end to end"
      },
      {
        key: "what_has_been_tried_before",
        label: "What Has Been Tried Before",
        hint: "Previous attempts, what worked, what did not"
      }
    ]
  },
  3: {
    description:
      "Define the target HubSpot design, future-state process, automation, integrations, and reporting.",
    fields: [
      {
        key: "hubs_and_features_required",
        label: "Hubs & Features Required",
        hint: "Which HubSpot hubs and specific features are in scope?"
      },
      {
        key: "pipeline_and_process_design",
        label: "Pipeline & Process Design",
        hint: "Agreed future state - stages, owners, handoffs"
      },
      {
        key: "automation_requirements",
        label: "Automation Requirements",
        hint: "What should be automated? Lead routing, sequences, notifications"
      },
      {
        key: "integration_requirements",
        label: "Integration Requirements",
        hint: "What tools need to connect to HubSpot?"
      },
      {
        key: "reporting_requirements",
        label: "Reporting Requirements",
        hint: "What dashboards and reports are needed at go-live?"
      }
    ]
  },
  4: {
    description:
      "Lock delivery boundaries, client responsibilities, risks, and agreed next steps.",
    fields: [
      {
        key: "confirmed_scope",
        label: "Confirmed Scope",
        hint: "What is definitively in scope for this engagement?"
      },
      {
        key: "out_of_scope",
        label: "Out of Scope",
        hint: "What has been explicitly excluded?"
      },
      {
        key: "risks_and_blockers",
        label: "Risks & Blockers",
        hint: "What could delay or derail this project?"
      },
      {
        key: "client_responsibilities",
        label: "Client Responsibilities",
        hint: "What does the client need to provide or action?"
      },
      {
        key: "agreed_next_steps",
        label: "Agreed Next Steps",
        hint: "Immediate actions after this session"
      },
      {
        key: "engagement_track",
        label: "Engagement Track",
        hint: "Classify the project as greenfield, onboarding, optimisation, or migration.",
        input: "select",
        options: [
          { value: "", label: "Select track" },
          { value: "new-crm-greenfield", label: "New CRM / Greenfield" },
          { value: "hubspot-onboarding-new-build", label: "HubSpot Onboarding / New Build" },
          { value: "hubspot-optimisation-revamp", label: "HubSpot Optimisation / Revamp" },
          { value: "migration-to-hubspot", label: "Migration to HubSpot" }
        ]
      },
      {
        key: "platform_fit",
        label: "Platform Fit",
        hint: "Record whether HubSpot is clearly right, possible with caveats, or not recommended.",
        input: "select",
        options: [
          { value: "", label: "Select platform fit" },
          { value: "fit-confirmed", label: "Fit confirmed" },
          { value: "fit-possible-with-caveats", label: "Fit possible with caveats" },
          { value: "fit-not-recommended", label: "Fit not recommended" }
        ]
      },
      {
        key: "change_management_rating",
        label: "Change Management Rating",
        hint: "Assess expected adoption and change resistance.",
        input: "select",
        options: [
          { value: "", label: "Select rating" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" }
        ]
      },
      {
        key: "data_readiness_rating",
        label: "Data Readiness Rating",
        hint: "Assess current data quality, ownership, and migration readiness.",
        input: "select",
        options: [
          { value: "", label: "Select rating" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" }
        ]
      },
      {
        key: "scope_volatility_rating",
        label: "Scope Volatility Rating",
        hint: "Estimate how likely the scope is to shift during onboarding.",
        input: "select",
        options: [
          { value: "", label: "Select rating" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" }
        ]
      }
    ]
  }
};

function statusLabel(status: SessionDetail["status"]) {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

function statusClass(status: SessionDetail["status"]) {
  switch (status) {
    case "complete":
      return "status-ready";
    case "in_progress":
      return "status-in-progress";
    default:
      return "status-draft";
  }
}

function createSessionDrafts(
  sessionDetails: SessionDetail[]
): Record<number, Record<string, string>> {
  return [1, 2, 3, 4].reduce<Record<number, Record<string, string>>>(
    (drafts, sessionNumber) => {
      const session =
        sessionDetails.find(
          (candidate) => candidate.session === sessionNumber
        ) ?? null;
      const fieldDefinitions = sessionDefinitions[sessionNumber]?.fields ?? [];

      drafts[sessionNumber] = Object.fromEntries(
        fieldDefinitions.map(({ key }) => [key, session?.fields[key] ?? ""])
      );

      return drafts;
    },
    { 1: {}, 2: {}, 3: {}, 4: {} }
  );
}

function createSessionFlags(defaultValue: boolean) {
  return { 1: defaultValue, 2: defaultValue, 3: defaultValue, 4: defaultValue };
}

function createSessionErrors() {
  return { 1: null, 2: null, 3: null, 4: null } as Record<
    number,
    string | null
  >;
}

function createSessionTextState() {
  return { 1: "", 2: "", 3: "", 4: "" } as Record<number, string>;
}

export default function DiscoveryWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [sessionDrafts, setSessionDrafts] = useState<
    Record<number, Record<string, string>>
  >({
    1: {},
    2: {},
    3: {},
    4: {}
  });
  const [savingSessions, setSavingSessions] = useState(
    createSessionFlags(false)
  );
  const [sessionErrors, setSessionErrors] = useState(createSessionErrors());
  const [assistantNotes, setAssistantNotes] = useState(createSessionTextState());
  const [assistantDocUrls, setAssistantDocUrls] = useState(
    createSessionTextState()
  );
  const [extractingSessions, setExtractingSessions] = useState(
    createSessionFlags(false)
  );
  const [fetchingDocs, setFetchingDocs] = useState(createSessionFlags(false));
  const [assistantMessages, setAssistantMessages] = useState(
    createSessionErrors()
  );
  const [loading, setLoading] = useState(true);
  const [generatingBlueprint, setGeneratingBlueprint] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [projectResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`)
        ]);

        if (!projectResponse.ok || !sessionsResponse.ok) {
          throw new Error("Failed to load discovery workspace");
        }

        const projectBody = await projectResponse.json();
        const sessionsBody = await sessionsResponse.json();
        const nextSessions = sessionsBody.sessionDetails ?? [];

        setProject(projectBody.project);
        setSessions(nextSessions);
        setSessionDrafts(createSessionDrafts(nextSessions));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load discovery workspace"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, [projectId]);

  const session1Complete =
    sessions.find((session) => session.session === 1)?.status === "complete";
  const session3Complete =
    sessions.find((session) => session.session === 3)?.status === "complete";
  const canGenerateBlueprint = session1Complete && session3Complete;
  const completedSessions = sessions.filter(
    (session) => session.status === "complete"
  ).length;

  function updateSessionDraft(
    sessionNumber: number,
    fieldKey: string,
    value: string
  ) {
    setSessionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [sessionNumber]: {
        ...currentDrafts[sessionNumber],
        [fieldKey]: value
      }
    }));
  }

  function updateAssistantNotes(sessionNumber: number, value: string) {
    setAssistantNotes((currentState) => ({
      ...currentState,
      [sessionNumber]: value
    }));
  }

  function updateAssistantDocUrl(sessionNumber: number, value: string) {
    setAssistantDocUrls((currentState) => ({
      ...currentState,
      [sessionNumber]: value
    }));
  }

  async function extractSessionFromNotes(sessionNumber: number) {
    const noteText = assistantNotes[sessionNumber]?.trim() ?? "";

    if (!noteText) {
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]: "Paste meeting notes or a Gemini summary first."
      }));
      return;
    }

    setExtractingSessions((currentFlags) => ({
      ...currentFlags,
      [sessionNumber]: true
    }));
    setAssistantMessages((currentMessages) => ({
      ...currentMessages,
      [sessionNumber]: null
    }));

    try {
      const response = await fetch("/api/discovery/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session: sessionNumber,
          text: noteText
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to extract session notes");
      }

      const extractedFields = body?.fields ?? {};
      setSessionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [sessionNumber]: {
          ...currentDrafts[sessionNumber],
          ...extractedFields
        }
      }));
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]:
          body?.message ??
          "Draft fields updated from AI extraction. Review and save when ready."
      }));
    } catch (extractError) {
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]:
          extractError instanceof Error
            ? extractError.message
            : "Failed to extract session notes"
      }));
    } finally {
      setExtractingSessions((currentFlags) => ({
        ...currentFlags,
        [sessionNumber]: false
      }));
    }
  }

  async function extractSessionFromDoc(sessionNumber: number) {
    const docUrl = assistantDocUrls[sessionNumber]?.trim() ?? "";

    if (!docUrl) {
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]: "Add a public Google Doc URL first."
      }));
      return;
    }

    setFetchingDocs((currentFlags) => ({
      ...currentFlags,
      [sessionNumber]: true
    }));
    setAssistantMessages((currentMessages) => ({
      ...currentMessages,
      [sessionNumber]: null
    }));

    try {
      const response = await fetch("/api/discovery/fetch-doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session: sessionNumber,
          url: docUrl
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to fetch and extract document");
      }

      const extractedFields = body?.fields ?? {};
      setSessionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [sessionNumber]: {
          ...currentDrafts[sessionNumber],
          ...extractedFields
        }
      }));
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]:
          body?.message ??
          "Draft fields updated from the Google Doc. Review and save when ready."
      }));
    } catch (extractError) {
      setAssistantMessages((currentMessages) => ({
        ...currentMessages,
        [sessionNumber]:
          extractError instanceof Error
            ? extractError.message
            : "Failed to fetch and extract document"
      }));
    } finally {
      setFetchingDocs((currentFlags) => ({
        ...currentFlags,
        [sessionNumber]: false
      }));
    }
  }

  async function saveSession(sessionNumber: number) {
    setSavingSessions((currentFlags) => ({
      ...currentFlags,
      [sessionNumber]: true
    }));
    setSessionErrors((currentErrors) => ({
      ...currentErrors,
      [sessionNumber]: null
    }));

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/sessions/${sessionNumber}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: sessionDrafts[sessionNumber]
          })
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save session");
      }

      const body = await response.json();
      const nextSession = body.sessionDetail as SessionDetail;

      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.session === sessionNumber ? nextSession : session
        )
      );
      setSessionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [sessionNumber]: nextSession.fields
      }));
    } catch (saveError) {
      setSessionErrors((currentErrors) => ({
        ...currentErrors,
        [sessionNumber]:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save session"
      }));
    } finally {
      setSavingSessions((currentFlags) => ({
        ...currentFlags,
        [sessionNumber]: false
      }));
    }
  }

  async function generateBlueprint() {
    setGeneratingBlueprint(true);
    setBlueprintError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/blueprint/generate`,
        {
          method: "POST"
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate blueprint");
      }

      await response.json();
      router.push(`/blueprint/${projectId}`);
    } catch (generationError) {
      setBlueprintError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate blueprint"
      );
    } finally {
      setGeneratingBlueprint(false);
    }
  }

  return (
    <AppShell>
      <div className="p-8">
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : error || !project ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error ?? "Project not found"}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-sm text-text-muted"
                >
                  Back to overview
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  Discovery - {project.name}
                </h1>
                <p className="mt-2 text-text-secondary">
                  {project.client.name} - {project.selectedHubs.join(", ")}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-5 py-4 text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Sessions complete
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {completedSessions}/4
                  </p>
                </div>

                <button
                  type="button"
                  onClick={generateBlueprint}
                  disabled={!canGenerateBlueprint || generatingBlueprint}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${
                    canGenerateBlueprint && !generatingBlueprint
                      ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]"
                      : "cursor-not-allowed border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted"
                  }`}
                >
                  {generatingBlueprint ? "Generating..." : "Generate Blueprint"}
                </button>
                {blueprintError ? (
                  <p className="max-w-sm text-right text-sm text-[#ff8f9c]">
                    {blueprintError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Phase 2 readiness
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Blueprint generation unlocks when Session 1 and Session 3
                    are complete
                  </h2>
                  <p className="mt-2 max-w-3xl text-text-secondary">
                    Session 1 validates the business case and success criteria.
                    Session 3 defines the future-state HubSpot design. Both are
                    required before DeplyOS can create a reliable delivery
                    blueprint.
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Required sessions
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white">Session 1</span>
                      <span
                        className={statusClass(sessions[0]?.status ?? "draft")}
                      >
                        {statusLabel(sessions[0]?.status ?? "draft")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white">Session 3</span>
                      <span
                        className={statusClass(sessions[2]?.status ?? "draft")}
                      >
                        {statusLabel(sessions[2]?.status ?? "draft")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {sessions.map((session) => {
                const sessionDefinition = sessionDefinitions[session.session];
                const currentDraft = sessionDrafts[session.session] ?? {};
                const completedFieldCount = (
                  sessionDefinition?.fields ?? []
                ).filter(
                  ({ key }) => currentDraft[key]?.trim().length > 0
                ).length;

                return (
                  <section
                    key={session.session}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Session {session.session}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          {session.title}
                        </h2>
                      </div>

                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                          session.status
                        )}`}
                      >
                        {statusLabel(session.status)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-text-secondary">
                      {sessionDefinition?.description}
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Fields completed
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {completedFieldCount}/5
                        </p>
                      </div>

                      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Blueprint dependency
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {session.session === 1 || session.session === 3
                            ? "Required for generation"
                            : "Supports scoping detail"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                      <div className="lg:col-span-2 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              AI Assist
                            </p>
                            <h3 className="mt-2 text-lg font-semibold text-white">
                              Draft this session from notes or a public Google Doc
                            </h3>
                            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                              Paste your Gemini summary or meeting notes, or point
                              DeployOS at a public Google Doc, and it will prefill
                              the fields below for review.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-medium text-white">
                              Notes or Gemini summary
                            </span>
                            <textarea
                              value={assistantNotes[session.session] ?? ""}
                              onChange={(event) =>
                                updateAssistantNotes(
                                  session.session,
                                  event.target.value
                                )
                              }
                              className="mt-3 min-h-[150px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void extractSessionFromNotes(session.session)
                              }
                              disabled={extractingSessions[session.session]}
                              className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                            >
                              {extractingSessions[session.session]
                                ? "Extracting..."
                                : "Extract from Notes"}
                            </button>
                          </label>

                          <label className="block">
                            <span className="text-sm font-medium text-white">
                              Public Google Doc URL
                            </span>
                            <input
                              value={assistantDocUrls[session.session] ?? ""}
                              onChange={(event) =>
                                updateAssistantDocUrl(
                                  session.session,
                                  event.target.value
                                )
                              }
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <p className="mt-2 text-xs text-text-muted">
                              The document must be accessible for export to work.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void extractSessionFromDoc(session.session)
                              }
                              disabled={fetchingDocs[session.session]}
                              className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                            >
                              {fetchingDocs[session.session]
                                ? "Fetching..."
                                : "Extract from Google Doc"}
                            </button>
                          </label>
                        </div>

                        {assistantMessages[session.session] ? (
                          <p className="mt-4 text-sm text-text-secondary">
                            {assistantMessages[session.session]}
                          </p>
                        ) : null}
                      </div>

                      {(sessionDefinition?.fields ?? []).map((field) => (
                        <label key={field.key} className="block">
                          <span className="text-sm font-medium text-white">
                            {field.label}
                          </span>
                          <span className="mt-1 block text-xs text-text-muted">
                            {field.hint}
                          </span>
                          {field.input === "select" ? (
                            <select
                              value={currentDraft[field.key] ?? ""}
                              onChange={(event) =>
                                updateSessionDraft(
                                  session.session,
                                  field.key,
                                  event.target.value
                                )
                              }
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              {(field.options ?? []).map((option) => (
                                <option
                                  key={option.value || "__empty"}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <textarea
                              value={currentDraft[field.key] ?? ""}
                              onChange={(event) =>
                                updateSessionDraft(
                                  session.session,
                                  field.key,
                                  event.target.value
                                )
                              }
                              className="mt-3 min-h-[150px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          )}
                        </label>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-[#ff8f9c]">
                        {sessionErrors[session.session] ?? ""}
                      </div>
                      <button
                        type="button"
                        onClick={() => saveSession(session.session)}
                        disabled={savingSessions[session.session]}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {savingSessions[session.session]
                          ? "Saving..."
                          : "Save Session"}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
