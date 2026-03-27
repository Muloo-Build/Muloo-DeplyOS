"use client";

import { useEffect, useMemo, useState } from "react";

import ProjectWorkflowNav from "./ProjectWorkflowNav";

interface ProjectSummary {
  id: string;
  name: string;
  engagementType: string;
  portal: {
    id: string;
    displayName: string;
    portalId: string;
    connected: boolean;
  } | null;
}

interface PortalSnapshot {
  id: string;
  portalId: string;
  capturedAt: string;
  hubTier: string | null;
  activeHubs: string[];
  contactPropertyCount: number | null;
  companyPropertyCount: number | null;
  dealPropertyCount: number | null;
  ticketPropertyCount: number | null;
  customObjectCount: number | null;
  dealPipelineCount: number | null;
  dealStageCount: number | null;
  ticketPipelineCount: number | null;
  activeUserCount: number | null;
  teamCount: number | null;
  activeListCount: number | null;
}

interface FindingRecord {
  id: string;
  projectId: string;
  area: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string | null;
  category: string | null;
  title: string;
  description: string;
  quickWin: boolean;
  phaseRecommendation: string;
  evidence: unknown;
  status: "open" | "in_progress" | "resolved";
  recommendations: Array<{
    id: string;
    title: string;
    rationale: string;
    type: "quick_win" | "structural" | "advisory";
    impact: "low" | "medium" | "high";
    effort: "xs" | "s" | "m" | "l" | "xl";
    phase: string;
    findingId: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface RecommendationRecord {
  id: string;
  projectId: string;
  title: string;
  area: string;
  type: "quick_win" | "structural" | "advisory";
  phase: string;
  rationale: string;
  effort: "xs" | "s" | "m" | "l" | "xl";
  impact: "low" | "medium" | "high";
  clientApprovalStatus: "pending" | "approved" | "rejected";
  findingId: string | null;
  linkedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface ExecutionJob {
  id: string;
  jobType: string | null;
  status: string;
  resultStatus: string | null;
  outputSummary: string | null;
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

interface FindingDraft {
  severity: FindingRecord["severity"];
  title: string;
  description: string;
  quickWin: boolean;
  evidence: string;
}

const auditAreas = [
  { key: "crm", label: "CRM Foundation" },
  { key: "pipelines", label: "Pipelines" },
  { key: "properties", label: "Properties" },
  { key: "views", label: "Views & Lists" },
  { key: "dashboards", label: "Dashboards" },
  { key: "workflows", label: "Workflows" },
  { key: "team", label: "Team & Permissions" },
  { key: "data_quality", label: "Data Quality" },
  { key: "integrations", label: "Integrations" },
  { key: "sequences", label: "Sequences" },
  { key: "reporting", label: "Reporting" }
] as const;

const severityClassName: Record<FindingRecord["severity"], string> = {
  low: "bg-[rgba(255,255,255,0.08)] text-text-secondary",
  medium: "bg-[rgba(255,214,102,0.16)] text-[#ffd666]",
  high: "bg-[rgba(240,160,80,0.18)] text-[#f0a050]",
  critical: "bg-[rgba(255,154,165,0.18)] text-[#ff9aa5]"
};

const projectContextLabels: Record<string, string> = {
  existing_knowledge: "Existing knowledge",
  work_done: "Work done",
  meeting_notes: "Meeting notes",
  email_brief: "Email brief",
  session_prep: "Session prep",
  blockers: "Blockers"
};

function createFindingDraft(): FindingDraft {
  return {
    severity: "medium",
    title: "",
    description: "",
    quickWin: false,
    evidence: ""
  };
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCount(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-ZA");
}

function formatRecommendationRationale(value: string) {
  return value.replace(/^\[AI audit\]\s*/i, "").trim();
}

function formatEvidenceValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "No evidence captured.";
  }

  return JSON.stringify(value, null, 2);
}

function FindingModal({
  area,
  projectId,
  onClose,
  onCreated
}: {
  area: (typeof auditAreas)[number];
  projectId: string;
  onClose: () => void;
  onCreated: (finding: FindingRecord) => void;
}) {
  const [draft, setDraft] = useState<FindingDraft>(createFindingDraft());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submitFinding() {
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/findings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            area: area.key,
            severity: draft.severity,
            title: draft.title,
            description: draft.description,
            quickWin: draft.quickWin,
            evidence: draft.evidence || undefined
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create finding");
      }

      onCreated(body.finding);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create finding"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,18,0.84)] px-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[#111933] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-text-muted">
              New finding
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {area.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-text-secondary"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-white">Severity</span>
            <select
              value={draft.severity}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  severity: event.target.value as FindingRecord["severity"]
                }))
              }
              className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              checked={draft.quickWin}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quickWin: event.target.checked
                }))
              }
            />
            Mark as quick win
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-white">Title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-white">Description</span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              className="mt-2 min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-white">Evidence</span>
            <textarea
              value={draft.evidence}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  evidence: event.target.value
                }))
              }
              className="mt-2 min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p> : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => void submitFinding()}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#081120] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create finding"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalAuditWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContextMap>({});
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [recommendations, setRecommendations] = useState<
    RecommendationRecord[]
  >([]);
  const [auditJob, setAuditJob] = useState<ExecutionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [aiAuditBusy, setAiAuditBusy] = useState(false);
  const [aiAuditFeedback, setAiAuditFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditProviderKey, setAuditProviderKey] = useState("anthropic");
  const [availableProviders, setAvailableProviders] = useState<
    Array<{ providerKey: string; label: string; defaultModel: string | null; isEnabled: boolean; hasApiKey: boolean }>
  >([]);
  const [activeFindingArea, setActiveFindingArea] = useState<
    (typeof auditAreas)[number] | null
  >(null);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>(
    () => Object.fromEntries(auditAreas.map((area) => [area.key, true]))
  );

  async function loadAuditData() {
    setLoading(true);
    setError(null);

    try {
      const projectResponse = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`
      );
      const projectBody = await projectResponse.json().catch(() => null);

      if (!projectResponse.ok) {
        throw new Error(projectBody?.error ?? "Failed to load project");
      }

      setProject(projectBody.project);

      const findingsResponse = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/findings`
      );
      const recommendationsResponse = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/recommendations`
      );
      const projectContextResponse = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/context`
      );
      const findingsBody = await findingsResponse.json().catch(() => null);
      const recommendationsBody = await recommendationsResponse
        .json()
        .catch(() => null);
      const projectContextBody = await projectContextResponse
        .json()
        .catch(() => null);

      if (!findingsResponse.ok) {
        throw new Error(findingsBody?.error ?? "Failed to load findings");
      }

      if (!recommendationsResponse.ok) {
        throw new Error(
          recommendationsBody?.error ?? "Failed to load recommendations"
        );
      }

      if (!projectContextResponse.ok) {
        throw new Error(
          projectContextBody?.error ?? "Failed to load project context"
        );
      }

      setFindings(findingsBody.findings ?? []);
      setRecommendations(recommendationsBody.recommendations ?? []);
      setProjectContext((projectContextBody ?? {}) as ProjectContextMap);

      if (projectBody.project?.portal?.id) {
        const snapshotResponse = await fetch(
          `/api/portals/${encodeURIComponent(projectBody.project.portal.id)}/snapshot`
        );

        if (snapshotResponse.ok) {
          const snapshotBody = await snapshotResponse.json().catch(() => null);
          setSnapshot(snapshotBody?.snapshot ?? null);
        } else {
          setSnapshot(null);
        }
      } else {
        setSnapshot(null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load portal audit workspace"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditData();
    fetch("/api/provider-connections")
      .then((r) => r.json())
      .then((body: { providers?: Array<{ providerKey: string; label: string; defaultModel: string | null; isEnabled: boolean; hasApiKey: boolean }> }) => {
        const aiProviders = (body.providers ?? []).filter(
          (p) => p.isEnabled && p.hasApiKey && p.providerKey !== "hubspot_oauth"
        );
        setAvailableProviders(aiProviders);
        if (aiProviders.length > 0 && !aiProviders.find((p) => p.providerKey === "anthropic")) {
          setAuditProviderKey(aiProviders[0].providerKey);
        }
      })
      .catch(() => null);
  }, [projectId]);

  async function pollAuditJobStatus(jobId: string) {
    let keepPolling = true;

    while (keepPolling) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 3000);
      });

      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(jobId)}/status`
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to load audit job status");
      }

      const nextJob = body?.job ?? null;
      setAuditJob(nextJob);

      if (!nextJob) {
        keepPolling = false;
        setAiAuditBusy(false);
        return;
      }

      if (nextJob.status === "COMPLETED") {
        setAiAuditBusy(false);
        setAiAuditFeedback(nextJob.outputSummary ?? "Portal audit completed.");
        await loadAuditData();
        keepPolling = false;
      } else if (nextJob.status === "FAILED") {
        setAiAuditBusy(false);
        setError(nextJob.outputSummary ?? "Portal audit failed");
        keepPolling = false;
      }
    }
  }

  async function refreshSnapshot() {
    if (!project?.portal?.id) {
      return;
    }

    setSnapshotBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/portals/${encodeURIComponent(project.portal.id)}/snapshot`,
        {
          method: "POST"
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to refresh portal snapshot");
      }

      setSnapshot(body?.snapshot ?? null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh portal snapshot"
      );
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function runAiAudit() {
    setAiAuditBusy(true);
    setAiAuditFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/run/portal-audit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerKey: auditProviderKey })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate portal audit");
      }

      const job = body?.job ?? null;
      setAuditJob(job);

      if (!job?.id) {
        throw new Error("Portal audit job did not return an ID");
      }

      setAiAuditFeedback("Portal audit started. Running live checks now.");
      await pollAuditJobStatus(job.id);
    } catch (auditError) {
      setError(
        auditError instanceof Error
          ? auditError.message
          : "Failed to generate portal audit"
      );
      setAiAuditBusy(false);
    }
  }

  const findingsByArea = useMemo(() => {
    return auditAreas.reduce<Record<string, FindingRecord[]>>(
      (accumulator, area) => {
        accumulator[area.key] = findings.filter(
          (finding) => finding.area === area.key
        );
        return accumulator;
      },
      {}
    );
  }, [findings]);

  const severityCounts = useMemo(
    () =>
      findings.reduce<Record<FindingRecord["severity"], number>>(
        (accumulator, finding) => {
          accumulator[finding.severity] += 1;
          return accumulator;
        },
        {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      ),
    [findings]
  );

  const snapshotStats = [
    { label: "Hub Tier", value: snapshot?.hubTier ?? "Not captured yet" },
    {
      label: "Active Hubs",
      value: snapshot?.activeHubs?.length
        ? snapshot.activeHubs.map(formatLabel).join(", ")
        : "Not captured yet"
    },
    {
      label: "Contact Properties",
      value: formatCount(snapshot?.contactPropertyCount ?? null)
    },
    {
      label: "Company Properties",
      value: formatCount(snapshot?.companyPropertyCount ?? null)
    },
    {
      label: "Deal Properties",
      value: formatCount(snapshot?.dealPropertyCount ?? null)
    },
    {
      label: "Ticket Properties",
      value: formatCount(snapshot?.ticketPropertyCount ?? null)
    },
    {
      label: "Custom Objects",
      value: formatCount(snapshot?.customObjectCount ?? null)
    },
    {
      label: "Active Users",
      value: formatCount(snapshot?.activeUserCount ?? null)
    },
    {
      label: "Teams",
      value: formatCount(snapshot?.teamCount ?? null)
    },
    {
      label: "Active Lists",
      value: formatCount(snapshot?.activeListCount ?? null)
    },
    {
      label: "Deal Pipelines / Stages",
      value: snapshot
        ? `${formatCount(snapshot.dealPipelineCount)} / ${formatCount(snapshot.dealStageCount)}`
        : "—"
    },
    {
      label: "Ticket Pipelines",
      value: formatCount(snapshot?.ticketPipelineCount ?? null)
    }
  ];

  const activeContextLabels = Object.entries(projectContext)
    .filter(([, entry]) => Boolean(entry?.content?.trim()))
    .map(([contextType]) => projectContextLabels[contextType] ?? formatLabel(contextType));

  return (
    <>
      {activeFindingArea ? (
        <FindingModal
          area={activeFindingArea}
          projectId={projectId}
          onClose={() => {
            setActiveFindingArea(null);
          }}
          onCreated={(finding) => {
            setFindings((current) => [finding, ...current]);
          }}
        />
      ) : null}
      <div className="space-y-6">
        <ProjectWorkflowNav
          projectId={projectId}
          engagementType={project?.engagementType}
        />

        <section className="rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                HubSpot optimisation audit
              </p>
              <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                Portal Audit Workspace
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Capture portal context, document findings, and pull quick wins
                into delivery without leaving the project workflow.
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                Audit engine: OpenAI · gpt-4o
              </p>
              <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
                {activeContextLabels.length > 0 ? (
                  <span>
                    This audit will include your notes from:{" "}
                    <span className="text-white">
                      {activeContextLabels.join(", ")}
                    </span>
                  </span>
                ) : (
                  <span>
                    Add notes in Prepare before running the audit to improve
                    output quality.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {availableProviders.length > 1 ? (
                <select
                  value={auditProviderKey}
                  onChange={(e) => setAuditProviderKey(e.target.value)}
                  disabled={aiAuditBusy}
                  className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-3 py-3 text-sm text-text-secondary focus:outline-none disabled:opacity-60"
                >
                  {availableProviders.map((p) => (
                    <option key={p.providerKey} value={p.providerKey}>
                      {p.label}{p.defaultModel ? ` (${p.defaultModel})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => void runAiAudit()}
                disabled={aiAuditBusy || !project?.portal?.id}
                className="rounded-xl border border-[rgba(240,130,74,0.25)] bg-[rgba(240,130,74,0.14)] px-4 py-3 text-sm font-medium text-[#f0824a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiAuditBusy ? "Running AI Audit..." : "Run AI Audit"}
              </button>
              <button
                type="button"
                onClick={() => void refreshSnapshot()}
                disabled={snapshotBusy || !project?.portal?.id}
                className="rounded-xl border border-[rgba(81,208,176,0.2)] bg-[rgba(81,208,176,0.12)] px-4 py-3 text-sm font-medium text-[#51d0b0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {snapshotBusy ? "Refreshing..." : "Refresh Snapshot"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
                />
              ))}
            </div>
          ) : (
            <>
              {error ? (
                <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p>
              ) : null}
              {aiAuditFeedback ? (
                <p className="mt-4 text-sm text-status-success">
                  {aiAuditFeedback}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {(["critical", "high", "medium", "low"] as const).map(
                  (severity) => (
                    <div
                      key={severity}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                        {severity}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {severityCounts[severity]}
                      </p>
                    </div>
                  )
                )}
                {auditJob ? (
                  <div className="min-w-[260px] rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                      Audit job
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {auditJob.outputSummary || formatLabel(auditJob.status)}
                    </p>
                    <p className="mt-2 text-xs text-text-secondary">
                      Status: {formatLabel(auditJob.status)}
                    </p>
                  </div>
                ) : null}
              </div>
              {!project?.portal ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-5 py-5 text-sm text-text-secondary">
                  Connect the client’s HubSpot portal first, then this audit
                  workspace can capture a snapshot and track findings.
                </div>
              ) : (
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {snapshotStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-sm text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                AI Recommendations
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Prioritised next actions
              </h2>
            </div>
            <div className="rounded-xl bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
              {recommendations.length} recommendation
              {recommendations.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {recommendations.length > 0 ? (
              recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                      {formatLabel(recommendation.type)}
                    </span>
                    <span className="rounded-full bg-[rgba(81,208,176,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#51d0b0]">
                      {formatLabel(recommendation.area)}
                    </span>
                    <span className="rounded-full bg-[rgba(240,130,74,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#f0824a]">
                      Effort {recommendation.effort.toUpperCase()}
                    </span>
                    <span className="rounded-full bg-[rgba(140,190,255,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#8cbcff]">
                      Impact {formatLabel(recommendation.impact)}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-white">
                    {recommendation.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {formatRecommendationRationale(recommendation.rationale)}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-text-muted">
                    {recommendation.phase}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-5 py-5 text-sm text-text-secondary lg:col-span-2">
                Run the AI audit to generate detailed recommendations for this
                portal.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                Module audit
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Structured area review
              </h2>
            </div>
            <div className="rounded-xl bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
              {findings.length} findings logged
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {findings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-5 py-5 text-sm text-text-secondary">
                <p>No findings yet. Run a portal audit to get started.</p>
                <button
                  type="button"
                  onClick={() => void runAiAudit()}
                  disabled={aiAuditBusy || !project?.portal?.id}
                  className="mt-4 rounded-xl border border-[rgba(240,130,74,0.25)] bg-[rgba(240,130,74,0.14)] px-4 py-3 text-sm font-medium text-[#f0824a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiAuditBusy ? "Running AI Audit..." : "Run Portal Audit"}
                </button>
              </div>
            ) : null}
            {auditAreas.map((area) => {
              const areaFindings = findingsByArea[area.key] ?? [];
              const isExpanded = expandedAreas[area.key] ?? true;

              return (
                <div
                  key={area.key}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAreas((current) => ({
                            ...current,
                            [area.key]: !isExpanded
                          }))
                        }
                        className="text-left"
                      >
                        <p className="text-lg font-semibold text-white">
                          {area.label}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {areaFindings.length} finding
                          {areaFindings.length === 1 ? "" : "s"} logged
                        </p>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveFindingArea(area)}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white"
                    >
                      Add Finding
                    </button>
                  </div>

                  {isExpanded ? (
                    <>
                      <div className="mt-4 grid gap-3">
                        {areaFindings.length > 0 ? (
                          areaFindings.map((finding) => (
                            <div
                              key={finding.id}
                              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityClassName[finding.severity]}`}
                                >
                                  {formatLabel(finding.severity)}
                                </span>
                                {finding.category ? (
                                  <span className="rounded-full bg-[rgba(140,190,255,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#8cbcff]">
                                    {formatLabel(finding.category)}
                                  </span>
                                ) : null}
                                {finding.quickWin ? (
                                  <span className="rounded-full bg-[rgba(81,208,176,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#51d0b0]">
                                    Quick Win
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                                  {formatLabel(finding.status)}
                                </span>
                              </div>
                              <p className="mt-3 text-sm font-medium text-white">
                                {finding.title}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-text-secondary">
                                {finding.description}
                              </p>
                              {finding.recommendations[0] ? (
                                <div className="mt-3 rounded-xl border border-[rgba(81,208,176,0.12)] bg-[rgba(81,208,176,0.08)] px-3 py-3">
                                  <p className="text-xs uppercase tracking-[0.18em] text-[#51d0b0]">
                                    Recommendation
                                  </p>
                                  <p className="mt-2 text-sm font-medium text-white">
                                    {finding.recommendations[0].title}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                                    {formatRecommendationRationale(
                                      finding.recommendations[0].rationale
                                    )}
                                  </p>
                                </div>
                              ) : null}
                              <details className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1730] px-3 py-3">
                                <summary className="cursor-pointer text-sm font-medium text-white">
                                  Evidence
                                </summary>
                                <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-text-secondary">
                                  {formatEvidenceValue(finding.evidence)}
                                </pre>
                              </details>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-4 text-sm text-text-secondary">
                            No findings yet. Run a portal audit to get started.
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
