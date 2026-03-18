"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  ownerEmail: string;
  clientChampionFirstName?: string | null;
  clientChampionLastName?: string | null;
  clientChampionEmail?: string | null;
  engagementType: string;
  selectedHubs: string[];
  updatedAt: string;
  client: {
    name: string;
    industry?: string | null;
    region?: string | null;
    website?: string | null;
    additionalWebsites?: string[];
    linkedinUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    xUrl?: string | null;
    youtubeUrl?: string | null;
  };
  portal: {
    portalId: string;
    displayName: string;
    region?: string | null;
    connected: boolean;
  } | null;
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface Blueprint {
  id: string;
  generatedAt: string;
  tasks: Array<{
    type: "Agent" | "Human" | "Client";
    effortHours: number;
  }>;
}

interface DiscoverySummary {
  executiveSummary: string;
  engagementTrack: string;
  platformFit: string;
  changeManagementRating: string;
  dataReadinessRating: string;
  scopeVolatilityRating: string;
  missingInformation: string[];
  keyRisks: string[];
  recommendedNextQuestions: string[];
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function isSessionComplete(session: SessionDetail | undefined) {
  if (!session) {
    return false;
  }

  const fieldValues = Object.values(session.fields);

  if (fieldValues.length === 0) {
    return false;
  }

  return fieldValues.every((value) => value.trim().length > 0);
}

const industryOptions = [
  "Accounting & Advisory",
  "Agency & Professional Services",
  "Construction & Property",
  "Education & Training",
  "Financial Services",
  "Healthcare",
  "Legal",
  "Manufacturing",
  "Nonprofit",
  "Retail & Ecommerce",
  "SaaS & Technology",
  "Travel & Hospitality",
  "Other"
];

type EditableField =
  | "clientName"
  | "type"
  | "portalId"
  | "owner"
  | "clientProfile"
  | "hubs"
  | "clientChampion"
  | null;

const engagementOptions = [
  { value: "IMPLEMENTATION", label: "Implementation" },
  { value: "MIGRATION", label: "Migration" },
  { value: "AUDIT", label: "Audit" },
  { value: "OPTIMISATION", label: "Optimisation" },
  { value: "GUIDED_DEPLOYMENT", label: "Guided Deployment" }
] as const;

const hubOptions = [
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "service", label: "Service" },
  { value: "ops", label: "Operations" },
  { value: "cms", label: "CMS/Content" }
] as const;

function createProjectDraft(project: Project) {
  return {
    clientName: project.client.name,
    type: project.engagementType,
    portalId: project.portal?.portalId ?? "",
    hubs: project.selectedHubs,
    owner: project.owner,
    ownerEmail: project.ownerEmail,
    clientIndustry: project.client.industry ?? "",
    clientWebsite: project.client.website ?? "",
    clientAdditionalWebsitesText: (project.client.additionalWebsites ?? []).join(
      "\n"
    ),
    clientLinkedinUrl: project.client.linkedinUrl ?? "",
    clientFacebookUrl: project.client.facebookUrl ?? "",
    clientInstagramUrl: project.client.instagramUrl ?? "",
    clientXUrl: project.client.xUrl ?? "",
    clientYoutubeUrl: project.client.youtubeUrl ?? "",
    clientChampionFirstName: project.clientChampionFirstName ?? "",
    clientChampionLastName: project.clientChampionLastName ?? "",
    clientChampionEmail: project.clientChampionEmail ?? ""
  };
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatEngagementType(value: string) {
  return (
    engagementOptions.find((option) => option.value === value)?.label ??
    formatLabel(value)
  );
}

function formatHubLabel(value: string) {
  return hubOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusClass(status: string) {
  switch (status) {
    case "complete":
    case "completed":
      return "status-ready";
    case "in_progress":
    case "active":
      return "status-in-progress";
    default:
      return "status-draft";
  }
}

function EditButton({
  onClick,
  label
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-[rgba(255,255,255,0.08)] p-2 text-text-muted opacity-0 transition hover:text-white group-hover:opacity-100"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.5 18.79 4 20l1.21-4.5 11.652-11.013Z"
        />
      </svg>
    </button>
  );
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [discoverySummary, setDiscoverySummary] =
    useState<DiscoverySummary | null>(null);
  const [projectDraft, setProjectDraft] = useState({
    clientName: "",
    type: "IMPLEMENTATION",
    portalId: "",
    owner: "",
    ownerEmail: "",
    clientIndustry: "",
    clientWebsite: "",
    clientAdditionalWebsitesText: "",
    clientLinkedinUrl: "",
    clientFacebookUrl: "",
    clientInstagramUrl: "",
    clientXUrl: "",
    clientYoutubeUrl: "",
    hubs: [] as string[],
    clientChampionFirstName: "",
    clientChampionLastName: "",
    clientChampionEmail: ""
  });
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [savingField, setSavingField] = useState<EditableField>(null);
  const [projectEditError, setProjectEditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const [
          projectResponse,
          sessionsResponse,
          blueprintResponse,
          summaryResponse,
          usersResponse
        ] =
          await Promise.all([
            fetch(`/api/projects/${encodeURIComponent(projectId)}`),
            fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
            fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`),
            fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery-summary`),
            fetch("/api/users")
          ]);

        if (
          !projectResponse.ok ||
          !sessionsResponse.ok ||
          !summaryResponse.ok ||
          !usersResponse.ok
        ) {
          throw new Error("Failed to load project");
        }

        const projectBody = await projectResponse.json();
        const sessionsBody = await sessionsResponse.json();
        const summaryBody = await summaryResponse.json();
        const usersBody = await usersResponse.json();

        setProject(projectBody.project);
        setProjectDraft(createProjectDraft(projectBody.project));
        setSessions(sessionsBody.sessionDetails ?? []);
        setDiscoverySummary(summaryBody.summary ?? null);
        setTeamUsers(usersBody.users ?? []);

        if (blueprintResponse.ok) {
          const blueprintBody = await blueprintResponse.json();
          setBlueprint(blueprintBody.blueprint);
        } else if (blueprintResponse.status !== 404) {
          throw new Error("Failed to load blueprint status");
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load project"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  const completedSessions = sessions.filter((session) =>
    isSessionComplete(session)
  ).length;
  const session1Complete = isSessionComplete(
    sessions.find((session) => session.session === 1)
  );
  const session3Complete = isSessionComplete(
    sessions.find((session) => session.session === 3)
  );
  const canGenerateBlueprint = session1Complete && session3Complete;
  const totalHumanHours =
    blueprint?.tasks
      .filter((task) => task.type === "Human")
      .reduce((total, task) => total + task.effortHours, 0) ?? 0;

  function startEditing(field: Exclude<EditableField, null>) {
    if (!project) {
      return;
    }

    setProjectDraft(createProjectDraft(project));
    setProjectEditError(null);
    setEditingField(field);
  }

  function cancelEditing() {
    if (!project) {
      return;
    }

    setProjectDraft(createProjectDraft(project));
    setProjectEditError(null);
    setEditingField(null);
  }

  function toggleHubSelection(hub: string) {
    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      hubs: currentDraft.hubs.includes(hub)
        ? currentDraft.hubs.filter((currentHub) => currentHub !== hub)
        : [...currentDraft.hubs, hub]
    }));
  }

  function selectOwner(ownerName: string) {
    const selectedOwner = teamUsers.find((user) => user.name === ownerName);

    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      owner: ownerName,
      ownerEmail: selectedOwner?.email ?? currentDraft.ownerEmail
    }));
  }

  async function saveField(field: Exclude<EditableField, null>) {
    if (!project) {
      return;
    }

    const payload =
      field === "clientName"
        ? { clientName: projectDraft.clientName }
        : field === "type"
          ? { type: projectDraft.type }
          : field === "portalId"
            ? { portalId: projectDraft.portalId }
            : field === "owner"
              ? {
                  owner: projectDraft.owner,
                  ownerEmail: projectDraft.ownerEmail
                }
            : field === "clientProfile"
              ? {
                  clientIndustry: projectDraft.clientIndustry,
                  clientWebsite: projectDraft.clientWebsite,
                  clientAdditionalWebsites: projectDraft.clientAdditionalWebsitesText
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                  clientLinkedinUrl: projectDraft.clientLinkedinUrl,
                  clientFacebookUrl: projectDraft.clientFacebookUrl,
                  clientInstagramUrl: projectDraft.clientInstagramUrl,
                  clientXUrl: projectDraft.clientXUrl,
                  clientYoutubeUrl: projectDraft.clientYoutubeUrl
                }
            : field === "clientChampion"
              ? {
                  clientChampionFirstName: projectDraft.clientChampionFirstName,
                  clientChampionLastName: projectDraft.clientChampionLastName,
                  clientChampionEmail: projectDraft.clientChampionEmail
                }
              : { hubs: projectDraft.hubs };

    setSavingField(field);
    setProjectEditError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update project");
      }

      const body = await response.json();
      setProject(body.project);
      setProjectDraft(createProjectDraft(body.project));
      setEditingField(null);
    } catch (saveError) {
      setProjectEditError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update project"
      );
    } finally {
      setSavingField(null);
    }
  }

  async function generateDiscoverySummary() {
    if (!project) {
      return;
    }

    setSummaryBusy(true);
    setSummaryError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/discovery-summary`,
        {
          method: "POST"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate discovery summary");
      }

      setDiscoverySummary(body?.summary ?? null);
    } catch (generationError) {
      setSummaryError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate discovery summary"
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function handleBlueprintAction() {
    if (!project) {
      return;
    }

    if (blueprint) {
      router.push(`/blueprint/${project.id}`);
      return;
    }

    setBlueprintBusy(true);
    setBlueprintError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/blueprint/generate`,
        {
          method: "POST"
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate blueprint");
      }

      const body = await response.json();
      setBlueprint(body.blueprint);
      router.push(`/blueprint/${project.id}`);
    } catch (generationError) {
      setBlueprintError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate blueprint"
      );
    } finally {
      setBlueprintBusy(false);
    }
  }

  function renderActions(field: Exclude<EditableField, null>) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveField(field)}
          disabled={savingField === field}
          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#081120] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingField === field ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-semibold text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  function renderError(field: Exclude<EditableField, null>) {
    return editingField === field && projectEditError ? (
      <p className="mt-3 text-sm text-[#ff8f9c]">{projectEditError}</p>
    ) : null;
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
                <Link href="/" className="text-sm text-text-muted">
                  Back to projects
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold font-heading text-white">
                    {project.name}
                  </h1>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                      project.status
                    )}`}
                  >
                    {formatLabel(project.status)}
                  </span>
                </div>
                <p className="mt-3 text-text-secondary">
                  {project.client.name}
                  {project.client.region ? ` - ${project.client.region}` : ""}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={generateDiscoverySummary}
                    disabled={summaryBusy}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {summaryBusy
                      ? "Generating Summary..."
                      : discoverySummary
                        ? "Refresh Agent Summary"
                        : "Generate Agent Summary"}
                  </button>
                  <Link
                    href={`/projects/${project.id}/discovery`}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                  >
                    Open Discovery
                  </Link>
                  <Link
                    href={`/projects/${project.id}/proposal`}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                  >
                    Open Review Doc
                  </Link>
                  <button
                    type="button"
                    onClick={handleBlueprintAction}
                    disabled={
                      blueprintBusy || (!blueprint && !canGenerateBlueprint)
                    }
                    className={`rounded-xl px-4 py-3 text-sm font-medium text-white ${
                      blueprint
                        ? "border border-[rgba(255,255,255,0.08)] bg-background-card"
                        : canGenerateBlueprint && !blueprintBusy
                          ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]"
                          : "cursor-not-allowed border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted"
                    }`}
                  >
                    {blueprintBusy
                      ? "Generating..."
                      : blueprint
                        ? "Open Blueprint"
                        : "Generate Blueprint"}
                  </button>
                </div>
                {blueprintError ? (
                  <p className="max-w-sm text-right text-sm text-[#ff8f9c]">
                    {blueprintError}
                  </p>
                ) : null}
                {summaryError ? (
                  <p className="max-w-sm text-right text-sm text-[#ff8f9c]">
                    {summaryError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Discovery", `${completedSessions}/4 sessions`, "text-white"],
                [
                  "Blueprint",
                  blueprint ? "Generated" : "Not generated",
                  blueprint ? "text-status-success" : "text-text-secondary"
                ],
                [
                  "Human Hours",
                  blueprint ? `${totalHumanHours} hrs` : "-",
                  "text-status-warning"
                ],
                [
                  "Last Updated",
                  formatDate(project.updatedAt),
                  "text-status-info"
                ]
              ].map(([label, value, valueClass]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                >
                  <p className="text-sm text-text-muted">{label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${valueClass}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <h2 className="text-lg font-semibold text-white">
                  Project Context
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Client Name
                        </p>
                        {editingField === "clientName" ? (
                          <>
                            <input
                              value={projectDraft.clientName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientName: event.target.value
                                }))
                              }
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            {renderActions("clientName")}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-white">
                            {project.client.name}
                          </p>
                        )}
                      </div>
                      {editingField !== "clientName" ? (
                        <EditButton
                          label="Edit client name"
                          onClick={() => startEditing("clientName")}
                        />
                      ) : null}
                    </div>
                    {renderError("clientName")}
                  </div>

                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Project Type
                        </p>
                        {editingField === "type" ? (
                          <>
                            <select
                              value={projectDraft.type}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  type: event.target.value
                                }))
                              }
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              {engagementOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {renderActions("type")}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-white">
                            {formatEngagementType(project.engagementType)}
                          </p>
                        )}
                      </div>
                      {editingField !== "type" ? (
                        <EditButton
                          label="Edit project type"
                          onClick={() => startEditing("type")}
                        />
                      ) : null}
                    </div>
                    {renderError("type")}
                  </div>

                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Portal ID
                        </p>
                        {editingField === "portalId" ? (
                          <>
                            <input
                              value={projectDraft.portalId}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  portalId: event.target.value
                                }))
                              }
                              placeholder="Pending"
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            {renderActions("portalId")}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-white">
                            {project.portal?.portalId ?? "Pending"}
                          </p>
                        )}
                      </div>
                      {editingField !== "portalId" ? (
                        <EditButton
                          label="Edit portal ID"
                          onClick={() => startEditing("portalId")}
                        />
                      ) : null}
                    </div>
                    {renderError("portalId")}
                  </div>
                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Owner
                        </p>
                        {editingField === "owner" ? (
                          <>
                            <select
                              value={projectDraft.owner}
                              onChange={(event) => selectOwner(event.target.value)}
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              {teamUsers.map((user) => (
                                <option key={user.id} value={user.name}>
                                  {user.name} - {user.role}
                                </option>
                              ))}
                            </select>
                            <p className="mt-3 text-sm text-text-secondary">
                              {projectDraft.ownerEmail}
                            </p>
                            {renderActions("owner")}
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-sm text-white">
                              {project.owner}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {project.ownerEmail}
                            </p>
                          </>
                        )}
                      </div>
                      {editingField !== "owner" ? (
                        <EditButton
                          label="Edit owner"
                          onClick={() => startEditing("owner")}
                        />
                      ) : null}
                    </div>
                    {renderError("owner")}
                  </div>
                  {[
                    ["Portal", project.portal?.displayName ?? "Pending"],
                    ["Blueprint Generated", blueprint ? "Yes" : "No"]
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {label}
                      </p>
                      <p className="mt-2 text-sm text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Client Profile
                      </p>
                      {editingField === "clientProfile" ? (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <select
                              value={projectDraft.clientIndustry}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientIndustry: event.target.value
                                }))
                              }
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              <option value="">Select industry</option>
                              {industryOptions.map((industry) => (
                                <option key={industry} value={industry}>
                                  {industry}
                                </option>
                              ))}
                            </select>
                            <input
                              value={projectDraft.clientWebsite}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientWebsite: event.target.value
                                }))
                              }
                              placeholder="Primary website"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          <textarea
                            value={projectDraft.clientAdditionalWebsitesText}
                            onChange={(event) =>
                              setProjectDraft((currentDraft) => ({
                                ...currentDraft,
                                clientAdditionalWebsitesText: event.target.value
                              }))
                            }
                            placeholder="Additional websites, one per line"
                            className="mt-3 min-h-[110px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                          />
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={projectDraft.clientLinkedinUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientLinkedinUrl: event.target.value
                                }))
                              }
                              placeholder="LinkedIn URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientFacebookUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientFacebookUrl: event.target.value
                                }))
                              }
                              placeholder="Facebook URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientInstagramUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientInstagramUrl: event.target.value
                                }))
                              }
                              placeholder="Instagram URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientXUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientXUrl: event.target.value
                                }))
                              }
                              placeholder="X / Twitter URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientYoutubeUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientYoutubeUrl: event.target.value
                                }))
                              }
                              placeholder="YouTube URL"
                              className="md:col-span-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          {renderActions("clientProfile")}
                        </>
                      ) : (
                        <>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-sm text-white">
                                {project.client.industry ?? "Industry not set"}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {project.client.website ?? "No primary website"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-text-secondary">
                                {(project.client.additionalWebsites ?? []).length > 0
                                  ? `${project.client.additionalWebsites?.length} additional website(s)`
                                  : "No additional websites"}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {[
                                  project.client.linkedinUrl && "LinkedIn",
                                  project.client.facebookUrl && "Facebook",
                                  project.client.instagramUrl && "Instagram",
                                  project.client.xUrl && "X",
                                  project.client.youtubeUrl && "YouTube"
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "No social profiles"}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {editingField !== "clientProfile" ? (
                      <EditButton
                        label="Edit client profile"
                        onClick={() => startEditing("clientProfile")}
                      />
                    ) : null}
                  </div>
                  {renderError("clientProfile")}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Client Champion
                      </p>
                      {editingField === "clientChampion" ? (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={projectDraft.clientChampionFirstName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientChampionFirstName: event.target.value
                                }))
                              }
                              placeholder="First name"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientChampionLastName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientChampionLastName: event.target.value
                                }))
                              }
                              placeholder="Last name"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          <input
                            value={projectDraft.clientChampionEmail}
                            onChange={(event) =>
                              setProjectDraft((currentDraft) => ({
                                ...currentDraft,
                                clientChampionEmail: event.target.value
                              }))
                            }
                            placeholder="Email"
                            className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                          />
                          {renderActions("clientChampion")}
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-white">
                            {[
                              project.clientChampionFirstName,
                              project.clientChampionLastName
                            ]
                              .filter(Boolean)
                              .join(" ") || "Not set"}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {project.clientChampionEmail ?? "No email recorded"}
                          </p>
                        </>
                      )}
                    </div>
                    {editingField !== "clientChampion" ? (
                      <EditButton
                        label="Edit client champion"
                        onClick={() => startEditing("clientChampion")}
                      />
                    ) : null}
                  </div>
                  {renderError("clientChampion")}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Hubs In Scope
                      </p>
                      {editingField === "hubs" ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {hubOptions.map((hub) => {
                              const selected = projectDraft.hubs.includes(
                                hub.value
                              );

                              return (
                                <button
                                  key={hub.value}
                                  type="button"
                                  onClick={() => toggleHubSelection(hub.value)}
                                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                    selected
                                      ? "border-[rgba(240,130,74,0.55)] bg-[rgba(240,130,74,0.18)] text-white"
                                      : "border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white"
                                  }`}
                                >
                                  {hub.label}
                                </button>
                              );
                            })}
                          </div>
                          {renderActions("hubs")}
                        </>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.selectedHubs.map((hub) => (
                            <span
                              key={hub}
                              className="rounded bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-white"
                            >
                              {formatHubLabel(hub)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {editingField !== "hubs" ? (
                      <EditButton
                        label="Edit hubs in scope"
                        onClick={() => startEditing("hubs")}
                      />
                    ) : null}
                  </div>
                  {renderError("hubs")}
                </div>
              </section>

              <div className="grid gap-6">
                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-white">
                      Discovery Progress
                    </h2>
                    <Link
                      href={`/projects/${project.id}/discovery`}
                      className="text-sm font-medium text-white"
                    >
                      Review
                    </Link>
                  </div>

                  <div className="mt-5 space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.session}
                        className="rounded-xl bg-[#0b1126] px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              Session {session.session} - {session.title}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {
                                Object.values(session.fields).filter(
                                  (value) => value.trim().length > 0
                                ).length
                              }
                              /
                              {Object.keys(session.fields).length} fields completed
                            </p>
                          </div>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                              isSessionComplete(session)
                                ? "complete"
                                : session.status
                            )}`}
                          >
                            {formatLabel(
                              isSessionComplete(session)
                                ? "complete"
                                : session.status
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                      Blueprint gate
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {canGenerateBlueprint
                        ? "Session 1 and Session 3 are complete. Blueprint generation is unlocked."
                        : "Finish Session 1 and Session 3 to unlock blueprint generation."}
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Agent Handoff Summary
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        Project-level discovery output for scoping, delivery
                        planning, and future agent delegation.
                      </p>
                    </div>
                  </div>

                  {discoverySummary ? (
                    <>
                      <p className="mt-5 text-sm text-text-secondary">
                        {discoverySummary.executiveSummary}
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          ["Engagement Track", discoverySummary.engagementTrack],
                          ["Platform Fit", discoverySummary.platformFit],
                          [
                            "Change Management",
                            discoverySummary.changeManagementRating
                          ],
                          [
                            "Data Readiness",
                            discoverySummary.dataReadinessRating
                          ],
                          [
                            "Scope Volatility",
                            discoverySummary.scopeVolatilityRating
                          ]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <p className="mt-2 text-sm text-white">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-3">
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Missing Information
                          </p>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {discoverySummary.missingInformation.length > 0 ? (
                              discoverySummary.missingInformation.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>No major gaps flagged.</li>
                            )}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Key Risks
                          </p>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {discoverySummary.keyRisks.length > 0 ? (
                              discoverySummary.keyRisks.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>No major risks flagged.</li>
                            )}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Recommended Next Questions
                          </p>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {discoverySummary.recommendedNextQuestions.length >
                            0 ? (
                              discoverySummary.recommendedNextQuestions.map(
                                (item) => <li key={item}>{item}</li>
                              )
                            ) : (
                              <li>No follow-up questions suggested yet.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                      <p className="text-sm text-text-secondary">
                        No saved handoff summary yet. Generate the agent summary
                        once there is enough discovery captured to produce a
                        useful project-level view.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
