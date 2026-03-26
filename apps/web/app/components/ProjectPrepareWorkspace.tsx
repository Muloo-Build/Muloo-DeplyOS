"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import ProjectWorkflowNav from "./ProjectWorkflowNav";
import { resolveProjectWorkspaceMode } from "./projectWorkspaceConfig";

interface ProjectRecord {
  id: string;
  name: string;
  status: string;
  engagementType: string;
  includesPortalAudit?: boolean;
  portalId?: string | null;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  updatedAt: string;
  selectedHubs: string[];
  defaultWorkspacePath?: string;
  client: {
    id: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    region?: string | null;
  };
  portal: {
    id: string;
    portalId: string;
    displayName: string;
    connected: boolean;
    connectedEmail?: string | null;
  } | null;
}

interface ClientMemoryProject {
  id: string;
  name: string;
  status: string;
  engagementType: string;
  updatedAt: string;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  selectedHubs: string[];
  defaultWorkspacePath?: string;
}

interface EvidenceItem {
  id: string;
  projectId: string;
  evidenceType:
    | "transcript"
    | "summary"
    | "uploaded-doc"
    | "website-link"
    | "screen-grab"
    | "miro-note"
    | "operator-note"
    | "client-input";
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  createdAt: string;
}

interface FindingRecord {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  quickWin: boolean;
  status: "open" | "in_progress" | "resolved";
}

interface RecommendationRecord {
  id: string;
  title: string;
  phase: string;
  type: string;
  impact: string;
}

interface PortalSnapshot {
  capturedAt: string;
  hubTier: string | null;
  activeHubs: string[];
  contactPropertyCount: number | null;
  companyPropertyCount: number | null;
  dealPropertyCount: number | null;
  customObjectCount: number | null;
  dealPipelineCount: number | null;
}

interface PrepareBrief {
  executiveSummary: string;
  meetingGoal: string;
  whatWeKnow: string[];
  openQuestions: string[];
  agenda: string[];
  recommendedApproach: string;
  likelyWorkstreams: string[];
  risks: string[];
  suggestedNextStep: string;
}

interface WorkflowRun {
  id: string;
  workflowKey: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  portalId: string | null;
  portalDisplayName: string | null;
  portalExternalId: string | null;
  providerKey: string | null;
  model: string | null;
  routeSource: string | null;
  requestText: string | null;
  summary: string | null;
  status: string;
  resultStatus: string | null;
  outputLog: string | null;
  errorLog: string | null;
  createdAt: string;
}

interface ProjectContextEntry {
  contextType: string;
  label: string;
  content: string;
  updatedAt: string;
}

type ProjectContextMap = Record<string, ProjectContextEntry | null>;

interface ClientMemory {
  previousProjects: ClientMemoryProject[];
  recentFindings: Array<{
    id: string;
    title: string;
    area: string;
    severity: string;
    status: string;
    quickWin: boolean;
    updatedAt: string;
    project: { id: string; name: string };
  }>;
  recentRecommendations: Array<{
    id: string;
    title: string;
    area: string;
    type: string;
    phase: string;
    impact: string;
    updatedAt: string;
    project: { id: string; name: string };
  }>;
  portalSnapshots: PortalSnapshot[];
  portalDiff: {
    fromCapturedAt: string;
    toCapturedAt: string;
    newHubs: string[];
    removedHubs: string[];
    contactPropertyDelta: number;
    companyPropertyDelta: number;
    dealPropertyDelta: number;
    customObjectDelta: number;
    dealPipelineDelta: number;
    dealStageDelta: number;
    activeUserDelta: number;
    activeListDelta: number;
  } | null;
  recentRuns: WorkflowRun[];
}

const evidenceTypeOptions: Array<{
  value: EvidenceItem["evidenceType"];
  label: string;
}> = [
  { value: "summary", label: "Meeting summary" },
  { value: "operator-note", label: "Operator note" },
  { value: "client-input", label: "Client input" },
  { value: "transcript", label: "Transcript" },
  { value: "website-link", label: "Website link" },
  { value: "uploaded-doc", label: "Document / PDF" },
  { value: "screen-grab", label: "Screen grab" },
  { value: "miro-note", label: "Miro note" }
];

const projectContextSections = [
  {
    contextType: "existing_knowledge",
    title: "Capture what you already know",
    description:
      "Document the current picture before the AI starts reasoning."
  },
  {
    contextType: "work_done",
    title: "What have we already done?",
    description:
      "Capture fixes, changes, and implementation work that should not be flagged again."
  },
  {
    contextType: "meeting_notes",
    title: "Meeting notes / session notes",
    description:
      "Store client call notes, session highlights, and live discoveries."
  },
  {
    contextType: "email_brief",
    title: "Email brief",
    description:
      "Summarise important email threads, decisions, and context worth carrying forward."
  },
  {
    contextType: "session_prep",
    title: "Generate a prep pack before the session",
    description:
      "Capture the prep notes that should shape the next workshop or onsite session."
  },
  {
    contextType: "blockers",
    title: "Blockers and sensitivities",
    description:
      "Call out risks, sensitivities, and known blockers before the audit or brief runs."
  }
] as const;

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatSignedCount(value: number) {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function formatLastUpdated(value: string) {
  return `Last updated ${new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))}`;
}

export default function ProjectPrepareWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRecord[]>(
    []
  );
  const [projectContext, setProjectContext] = useState<ProjectContextMap>({});
  const [projectContextDrafts, setProjectContextDrafts] = useState<
    Record<string, string>
  >({});
  const [savingContextType, setSavingContextType] = useState<string | null>(
    null
  );
  const [savedContextType, setSavedContextType] = useState<string | null>(null);
  const [supportingContext, setSupportingContext] = useState<EvidenceItem[]>([]);
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [clientMemory, setClientMemory] = useState<ClientMemory | null>(null);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [prepareBrief, setPrepareBrief] = useState<PrepareBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [contextDraft, setContextDraft] = useState({
    evidenceType: "summary" as EvidenceItem["evidenceType"],
    sourceLabel: "",
    sourceUrl: "",
    content: ""
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const projectResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );
        const projectBody = await projectResponse.json().catch(() => null);

        if (!projectResponse.ok) {
          throw new Error(projectBody?.error ?? "Failed to load project");
        }

        const resolvedProject = projectBody.project as ProjectRecord;
        const [
          findingsResponse,
          recommendationsResponse,
          contextResponse,
          projectContextResponse
        ] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}/findings`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/recommendations`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/sessions/0/evidence`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/context`)
        ]);
        const findingsBody = await findingsResponse.json().catch(() => null);
        const recommendationsBody = await recommendationsResponse
          .json()
          .catch(() => null);
        const contextBody = await contextResponse.json().catch(() => null);
        const projectContextBody = await projectContextResponse
          .json()
          .catch(() => null);

        if (!projectContextResponse.ok) {
          throw new Error(
            projectContextBody?.error ?? "Failed to load project context"
          );
        }

        let nextSnapshot: PortalSnapshot | null = null;
        let nextWorkflowRuns: WorkflowRun[] = [];
        let nextClientMemory: ClientMemory | null = null;

        const workflowRunsResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/workflow-runs`
        );
        const workflowRunsBody = await workflowRunsResponse
          .json()
          .catch(() => null);
        if (workflowRunsResponse.ok) {
          nextWorkflowRuns = workflowRunsBody?.workflowRuns ?? [];
        }

        if (resolvedProject.portal?.id) {
          const snapshotResponse = await fetch(
            `/api/portals/${encodeURIComponent(resolvedProject.portal.id)}/snapshot`
          );
          const snapshotBody = await snapshotResponse.json().catch(() => null);
          if (snapshotResponse.ok) {
            nextSnapshot = snapshotBody?.snapshot ?? null;
          }
        }

        const clientMemoryResponse = await fetch(
          `/api/clients/${encodeURIComponent(resolvedProject.client.id)}/memory?excludeProjectId=${encodeURIComponent(projectId)}`
        );
        const clientMemoryBody = await clientMemoryResponse
          .json()
          .catch(() => null);
        if (clientMemoryResponse.ok) {
          nextClientMemory = clientMemoryBody?.memory ?? null;
        }

        if (cancelled) {
          return;
        }

        setProject(resolvedProject);
        setFindings(findingsBody?.findings ?? []);
        setRecommendations(recommendationsBody?.recommendations ?? []);
        setProjectContext((projectContextBody ?? {}) as ProjectContextMap);
        setProjectContextDrafts(
          Object.fromEntries(
            projectContextSections.map(({ contextType }) => [
              contextType,
              projectContextBody?.[contextType]?.content ?? ""
            ])
          )
        );
        setSupportingContext(contextBody?.evidenceItems ?? []);
        setSnapshot(nextSnapshot);
        setClientMemory(nextClientMemory);
        setWorkflowRuns(nextWorkflowRuns);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load prepare workspace"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function saveProjectContextEntry(contextType: string) {
    setSavingContextType(contextType);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/context/${encodeURIComponent(contextType)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: projectContextDrafts[contextType] ?? "",
            source: "manual"
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save project context");
      }

      setProjectContext((current) => ({
        ...current,
        [contextType]: body?.entry ?? null
      }));
      setSavedContextType(contextType);
      window.setTimeout(() => {
        setSavedContextType((current) =>
          current === contextType ? null : current
        );
      }, 2000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save project context"
      );
    } finally {
      setSavingContextType((current) =>
        current === contextType ? null : current
      );
    }
  }

  const relatedProjects = useMemo(
    () => clientMemory?.previousProjects.slice(0, 6) ?? [],
    [clientMemory]
  );

  const workspaceMode = resolveProjectWorkspaceMode({
    engagementType: project?.engagementType,
    hasPortal: Boolean(project?.portalId || project?.portal)
  });

  const prepChecklist = [
    {
      label: "Portal audit ready",
      complete: Boolean(project?.portal && snapshot)
    },
    {
      label: "Existing client context loaded",
      complete:
        relatedProjects.length > 0 ||
        supportingContext.length > 0 ||
        (clientMemory?.recentRecommendations.length ?? 0) > 0
    },
    {
      label: "Operator prep notes captured",
      complete: supportingContext.length > 0
    },
    {
      label: "Recommended next actions available",
      complete:
        recommendations.length > 0 ||
        (clientMemory?.recentRecommendations.length ?? 0) > 0
    }
  ];

  async function addSupportingContext() {
    if (!project) {
      return;
    }

    setSavingContext(true);
    setContextError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/sessions/0/evidence`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(contextDraft)
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to add supporting context");
      }

      setSupportingContext((current) => [body.evidenceItem, ...current]);
      setContextDraft({
        evidenceType: "summary",
        sourceLabel: "",
        sourceUrl: "",
        content: ""
      });
    } catch (saveError) {
      setContextError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to add supporting context"
      );
    } finally {
      setSavingContext(false);
    }
  }

  async function generatePrepareBrief() {
    setBriefBusy(true);
    setBriefError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/prepare-brief/generate`,
        {
          method: "POST"
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate prepare brief");
      }

      setPrepareBrief(body?.brief ?? null);
      setWorkflowRuns((currentRuns) =>
        body?.run
          ? [body.run, ...currentRuns.filter((run) => run.id !== body.run.id)]
          : currentRuns
      );
    } catch (generationError) {
      setBriefError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate prepare brief"
      );
    } finally {
      setBriefBusy(false);
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
            <ProjectWorkflowNav
              projectId={project.id}
              showDiscovery
              engagementType={project.engagementType}
            />

            <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
                Prepare
              </p>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold font-heading text-white">
                    {project.name}
                  </h1>
                  <p className="mt-3 max-w-3xl text-text-secondary">
                    Move ahead of the meeting. Pull the portal into view, load
                    prior work, capture new context, and decide what needs to
                    be unpacked onsite before you scope anything further.
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(123,226,239,0.2)] bg-[rgba(123,226,239,0.08)] px-4 py-3 text-sm text-[#b7f5ff]">
                  {workspaceMode.label}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Meeting Readiness
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Walk in knowing what matters
                </h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {prepChecklist.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border p-4 ${
                        item.complete
                          ? "border-[rgba(45,212,160,0.22)] bg-[rgba(45,212,160,0.08)]"
                          : "border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
                      }`}
                    >
                      <p className="text-sm font-medium text-white">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {item.complete ? "Ready" : "Still needs attention"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Problem Framing
                    </p>
                    <p className="mt-3 text-sm text-text-secondary">
                      {project.problemStatement?.trim() ||
                        "No formal problem statement saved yet. Use the context notes below to capture what the client is now asking for."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Current Direction
                    </p>
                    <p className="mt-3 text-sm text-text-secondary">
                      {project.scopeExecutiveSummary?.trim() ||
                        project.solutionRecommendation?.trim() ||
                        "No scoped direction has been saved yet. Run audit, add context, and use the working doc to shape the next phase."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Quick Launch
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      href: `/projects/${project.id}/audit`,
                      title: "Run portal audit",
                      description:
                        "Check portal health, current state, and quick wins before the meeting."
                    },
                    {
                      href: `/projects/${project.id}/inputs`,
                      title: "Capture new request details",
                      description:
                        "Drop in what the client has asked for, what changed, and what needs validating onsite."
                    },
                    {
                      href: `/projects/${project.id}/proposal`,
                      title: "Open working doc",
                      description:
                        "Use the working document to organise findings, assumptions, and the shape of the next phase."
                    },
                    {
                      href: "/projects/portal-ops",
                      title: "Use Portal Ops",
                      description:
                        "Ask for a portal-specific implementation plan or pre-build logic against the connected HubSpot account."
                    }
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 transition hover:border-[rgba(255,255,255,0.14)]"
                    >
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {item.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Prior Client Work
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      What have we already done?
                    </h2>
                  </div>
                  <div className="rounded-xl bg-[#0b1126] px-4 py-2 text-sm text-text-secondary">
                    {relatedProjects.length} prior project
                    {relatedProjects.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {relatedProjects.length > 0 ? (
                    relatedProjects.map((relatedProject) => (
                      <Link
                        key={relatedProject.id}
                        href={
                          relatedProject.defaultWorkspacePath ??
                          `/projects/${relatedProject.id}`
                        }
                        className="block rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 transition hover:border-[rgba(255,255,255,0.14)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {relatedProject.name}
                            </p>
                            <p className="mt-2 text-sm text-text-secondary">
                              {formatLabel(relatedProject.engagementType)} ·{" "}
                              {formatLabel(relatedProject.status)}
                            </p>
                          </div>
                          <p className="text-xs text-text-muted">
                            {formatRelativeDate(relatedProject.updatedAt)}
                          </p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                      No prior project records were found for this client yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Portal Posture
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Current portal picture
                </h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Portal
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {project.portal?.displayName ?? "Not connected"}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {project.portal
                        ? `Portal ID ${project.portal.portalId}`
                        : "Connect the client portal to prepare against live data."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Latest Snapshot
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {snapshot ? formatRelativeDate(snapshot.capturedAt) : "Not captured"}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {snapshot
                        ? `${snapshot.activeHubs.length} active hubs · ${snapshot.dealPipelineCount ?? 0} deal pipelines`
                        : "Run the portal audit workspace to capture the latest footprint."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Open Findings
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {findings.filter((finding) => finding.status !== "resolved").length}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {findings.filter((finding) => finding.quickWin).length} quick wins identified
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Recommendations
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {recommendations.length}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {recommendations
                        .slice(0, 2)
                        .map((recommendation) => recommendation.title)
                        .join(" · ") || "No recommendations yet"}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Client Memory
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Recent signals across the account
                    </h2>
                  </div>
                  <div className="rounded-xl bg-[#0b1126] px-4 py-2 text-sm text-text-secondary">
                    {(clientMemory?.recentFindings.length ?? 0) +
                      (clientMemory?.recentRecommendations.length ?? 0)}{" "}
                    memory items
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-sm font-semibold text-white">
                      Recent findings
                    </p>
                    <div className="mt-3 space-y-3">
                      {clientMemory?.recentFindings.length ? (
                        clientMemory.recentFindings.slice(0, 4).map((finding) => (
                          <div key={finding.id} className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3">
                            <p className="text-sm text-white">{finding.title}</p>
                            <p className="mt-2 text-xs text-text-muted">
                              {finding.project.name} · {formatLabel(finding.area)} ·{" "}
                              {formatLabel(finding.severity)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-text-secondary">
                          No previous client findings captured yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-sm font-semibold text-white">
                      Recent recommendations
                    </p>
                    <div className="mt-3 space-y-3">
                      {clientMemory?.recentRecommendations.length ? (
                        clientMemory.recentRecommendations
                          .slice(0, 4)
                          .map((recommendation) => (
                            <div
                              key={recommendation.id}
                              className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3"
                            >
                              <p className="text-sm text-white">
                                {recommendation.title}
                              </p>
                              <p className="mt-2 text-xs text-text-muted">
                                {recommendation.project.name} ·{" "}
                                {formatLabel(recommendation.area)} ·{" "}
                                {formatLabel(recommendation.impact)}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-text-secondary">
                          No previous recommendations captured yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Memory Timeline
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Portal history and recent runs
                </h2>

                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-sm font-semibold text-white">
                      Portal snapshots
                    </p>
                    <div className="mt-3 space-y-3">
                      {clientMemory?.portalSnapshots.length ? (
                        clientMemory.portalSnapshots
                          .slice(0, 4)
                          .map((memorySnapshot) => (
                            <div
                              key={memorySnapshot.capturedAt}
                              className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3"
                            >
                              <p className="text-sm text-white">
                                {formatRelativeDate(memorySnapshot.capturedAt)}
                              </p>
                              <p className="mt-2 text-xs text-text-muted">
                                {(memorySnapshot.hubTier ?? "Unknown tier").toUpperCase()} ·{" "}
                                {memorySnapshot.activeHubs.length} hubs ·{" "}
                                {memorySnapshot.dealPipelineCount ?? 0} pipelines
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-text-secondary">
                          No snapshot history captured for this client yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-sm font-semibold text-white">
                      Portal diff
                    </p>
                    <div className="mt-3 space-y-3">
                      {clientMemory?.portalDiff ? (
                        <>
                          <p className="text-xs text-text-muted">
                            {formatRelativeDate(clientMemory.portalDiff.fromCapturedAt)}
                            {" "}to{" "}
                            {formatRelativeDate(clientMemory.portalDiff.toCapturedAt)}
                          </p>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                Hubs changed
                              </p>
                              <p className="mt-2 text-sm text-white">
                                +{clientMemory.portalDiff.newHubs.length} / -
                                {clientMemory.portalDiff.removedHubs.length}
                              </p>
                              <p className="mt-2 text-xs text-text-muted">
                                {clientMemory.portalDiff.newHubs.length
                                  ? `Added: ${clientMemory.portalDiff.newHubs
                                      .map((hub) => formatLabel(hub))
                                      .join(", ")}`
                                  : "No new hubs detected"}
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                {clientMemory.portalDiff.removedHubs.length
                                  ? `Removed: ${clientMemory.portalDiff.removedHubs
                                      .map((hub) => formatLabel(hub))
                                      .join(", ")}`
                                  : "No hubs removed"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                Structure delta
                              </p>
                              <div className="mt-2 space-y-1 text-xs text-text-muted">
                                <p>
                                  Contact properties:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.contactPropertyDelta
                                  )}
                                </p>
                                <p>
                                  Company properties:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.companyPropertyDelta
                                  )}
                                </p>
                                <p>
                                  Deal properties:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.dealPropertyDelta
                                  )}
                                </p>
                                <p>
                                  Custom objects:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.customObjectDelta
                                  )}
                                </p>
                                <p>
                                  Pipelines / stages:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.dealPipelineDelta
                                  )}{" "}
                                  /{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.dealStageDelta
                                  )}
                                </p>
                                <p>
                                  Active users / lists:{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.activeUserDelta
                                  )}{" "}
                                  /{" "}
                                  {formatSignedCount(
                                    clientMemory.portalDiff.activeListDelta
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-text-secondary">
                          Capture at least two portal snapshots to compare how
                          the client environment has changed over time.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-sm font-semibold text-white">
                      Recent AI runs
                    </p>
                    <div className="mt-3 space-y-3">
                      {(clientMemory?.recentRuns.length ?? 0) > 0 ? (
                        clientMemory?.recentRuns.slice(0, 4).map((run) => (
                          <div
                            key={run.id}
                            className="rounded-xl border border-[rgba(255,255,255,0.07)] px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-white">{run.title}</p>
                              <span className="text-xs text-text-muted">
                                {formatLabel(run.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-text-muted">
                              {formatRelativeDate(run.createdAt)}
                              {run.summary ? ` · ${run.summary}` : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-text-secondary">
                          No Prepare, Audit, or Portal Ops runs recorded yet for
                          this client.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.07)] pb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Consultant Context
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Notes that feed the AI
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                    These notes are auto-saved on blur and injected into the
                    audit and prepare brief so the platform understands what you
                    already know, what has been done, and what to avoid
                    re-flagging.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {projectContextSections.map((section) => {
                  const entry = projectContext[section.contextType];
                  return (
                    <label
                      key={section.contextType}
                      className="block rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {section.title}
                          </p>
                          <p className="mt-2 text-xs text-text-muted">
                            {section.description}
                          </p>
                        </div>
                        <div className="text-xs">
                          {savingContextType === section.contextType ? (
                            <span className="text-text-secondary">Saving...</span>
                          ) : savedContextType === section.contextType ? (
                            <span className="text-[#54e1b1]">Saved</span>
                          ) : null}
                        </div>
                      </div>
                      <textarea
                        value={projectContextDrafts[section.contextType] ?? ""}
                        onChange={(event) =>
                          setProjectContextDrafts((current) => ({
                            ...current,
                            [section.contextType]: event.target.value
                          }))
                        }
                        onBlur={() => void saveProjectContextEntry(section.contextType)}
                        placeholder={section.description}
                        className="mt-4 min-h-[156px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-3 text-sm text-white outline-none"
                      />
                      {entry?.updatedAt ? (
                        <p className="mt-3 text-xs text-text-muted">
                          {formatLastUpdated(entry.updatedAt)}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-text-muted">
                          No notes saved yet.
                        </p>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      AI Meeting Brief
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Generate a prep pack before the session
                    </h2>
                    <p className="mt-3 max-w-3xl text-text-secondary">
                      Pull together the current portal picture, prior client
                      work, findings, recommendations, and prep notes into a
                      meeting brief you can actually use.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generatePrepareBrief()}
                    disabled={briefBusy}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {briefBusy ? "Generating..." : "Generate brief"}
                  </button>
                </div>

                {briefError ? (
                  <div className="mt-4 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
                    {briefError}
                  </div>
                ) : null}

                {prepareBrief ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                        Executive Summary
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                        {prepareBrief.executiveSummary}
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                          Meeting Goal
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          {prepareBrief.meetingGoal}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                          Recommended Approach
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          {prepareBrief.recommendedApproach}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-6 text-sm text-text-secondary">
                    Generate the brief to get an executive summary, open
                    questions, and a suggested meeting structure before you head
                    into the session.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Brief Outputs
                </p>
                {prepareBrief ? (
                  <div className="mt-4 space-y-4">
                    {[
                      {
                        label: "What we know",
                        items: prepareBrief.whatWeKnow
                      },
                      {
                        label: "Open questions",
                        items: prepareBrief.openQuestions
                      },
                      {
                        label: "Agenda",
                        items: prepareBrief.agenda
                      },
                      {
                        label: "Likely workstreams",
                        items: prepareBrief.likelyWorkstreams
                      },
                      {
                        label: "Risks",
                        items: prepareBrief.risks
                      }
                    ].map(({ label, items }) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-sm font-semibold text-white">
                          {label}
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                          {items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-[rgba(123,226,239,0.22)] bg-[rgba(123,226,239,0.08)] p-4">
                      <p className="text-sm font-semibold text-white">
                        Suggested next step
                      </p>
                      <p className="mt-2 text-sm text-[#b7f5ff]">
                        {prepareBrief.suggestedNextStep}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                    The generated prep outputs will land here once you run the
                    briefing assistant.
                  </div>
                )}
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Prep Notes & Source Material
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Capture what you already know
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-white">Type</span>
                    <select
                      value={contextDraft.evidenceType}
                      onChange={(event) =>
                        setContextDraft((currentDraft) => ({
                          ...currentDraft,
                          evidenceType: event.target.value as EvidenceItem["evidenceType"]
                        }))
                      }
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-3 text-sm text-white outline-none"
                    >
                      {evidenceTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Label</span>
                    <input
                      value={contextDraft.sourceLabel}
                      onChange={(event) =>
                        setContextDraft((currentDraft) => ({
                          ...currentDraft,
                          sourceLabel: event.target.value
                        }))
                      }
                      placeholder="Example: client email summary"
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-white">
                      Link or source reference
                    </span>
                    <input
                      value={contextDraft.sourceUrl}
                      onChange={(event) =>
                        setContextDraft((currentDraft) => ({
                          ...currentDraft,
                          sourceUrl: event.target.value
                        }))
                      }
                      placeholder="Paste a doc link, website, file reference, or screenshot URL"
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-white">
                      Notes
                    </span>
                    <textarea
                      value={contextDraft.content}
                      onChange={(event) =>
                        setContextDraft((currentDraft) => ({
                          ...currentDraft,
                          content: event.target.value
                        }))
                      }
                      placeholder="Paste meeting prep notes, prior requirements, technical constraints, or questions to validate onsite."
                      className="mt-3 min-h-[180px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  {contextError ? (
                    <p className="text-sm text-[#ff8f9c]">{contextError}</p>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Add what the client already sent, what Muloo already knows,
                      and what needs to be validated in the room.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void addSupportingContext()}
                    disabled={savingContext}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingContext ? "Adding..." : "Add prep context"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Current Notes
                </p>
                <div className="mt-4 space-y-3">
                  {supportingContext.length > 0 ? (
                    supportingContext.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-sm font-semibold text-white">
                          {item.sourceLabel}
                        </p>
                        <p className="mt-2 text-xs text-text-muted">
                          {formatLabel(item.evidenceType)} ·{" "}
                          {formatRelativeDate(item.createdAt)}
                        </p>
                        {item.sourceUrl ? (
                          <p className="mt-3 break-all text-sm text-[#49cde1]">
                            {item.sourceUrl}
                          </p>
                        ) : null}
                        {item.content ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                            {item.content}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                      No prep notes captured yet. Add the client’s latest asks,
                      prior decisions, and meeting context here first.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
