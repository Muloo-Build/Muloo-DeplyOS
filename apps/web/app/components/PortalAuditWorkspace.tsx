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
  title: string;
  description: string;
  quickWin: boolean;
  phaseRecommendation: string;
  evidence: string | null;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

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
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFindingArea, setActiveFindingArea] = useState<
    (typeof auditAreas)[number] | null
  >(null);
  const [healthRatings, setHealthRatings] = useState<Record<string, number>>(
    () => Object.fromEntries(auditAreas.map((area) => [area.key, 3]))
  );
  const [issuesDrafts, setIssuesDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(auditAreas.map((area) => [area.key, ""]))
  );
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
      const findingsBody = await findingsResponse.json().catch(() => null);

      if (!findingsResponse.ok) {
        throw new Error(findingsBody?.error ?? "Failed to load findings");
      }

      setFindings(findingsBody.findings ?? []);

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
  }, [projectId]);

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
            </div>
            <button
              type="button"
              onClick={() => void refreshSnapshot()}
              disabled={snapshotBusy || !project?.portal?.id}
              className="rounded-xl border border-[rgba(81,208,176,0.2)] bg-[rgba(81,208,176,0.12)] px-4 py-3 text-sm font-medium text-[#51d0b0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {snapshotBusy ? "Refreshing..." : "Refresh Snapshot"}
            </button>
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
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() =>
                              setHealthRatings((current) => ({
                                ...current,
                                [area.key]: rating
                              }))
                            }
                            className={`rounded-xl px-3 py-2 text-sm font-medium ${
                              healthRatings[area.key] === rating
                                ? "border border-[rgba(81,208,176,0.35)] bg-[rgba(81,208,176,0.12)] text-[#51d0b0]"
                                : "border border-[rgba(255,255,255,0.08)] bg-background-card text-text-secondary"
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={issuesDrafts[area.key] ?? ""}
                        onChange={(event) =>
                          setIssuesDrafts((current) => ({
                            ...current,
                            [area.key]: event.target.value
                          }))
                        }
                        placeholder={`Capture working notes for ${area.label.toLowerCase()} here.`}
                        className="mt-4 min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-3 text-sm text-white outline-none"
                      />

                      <div className="mt-4 flex flex-wrap gap-3">
                        {areaFindings.length > 0 ? (
                          areaFindings.map((finding) => (
                            <div
                              key={finding.id}
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityClassName[finding.severity]}`}
                                >
                                  {formatLabel(finding.severity)}
                                </span>
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
                              <p className="mt-2 text-sm text-text-secondary">
                                {finding.description}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-4 text-sm text-text-secondary">
                            No findings logged for this area yet.
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
