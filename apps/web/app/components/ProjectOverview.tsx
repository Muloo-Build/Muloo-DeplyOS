"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  owner: {
    name: string;
    email: string;
  };
  clientContext: {
    clientName: string;
    primaryRegion: string;
    implementationType: string;
    notes: string;
  };
  hubspotScope: {
    hubsInScope: string[];
    environment: string;
    portal: {
      portalId: string;
      displayName: string;
      region?: string;
      connected: boolean;
    };
  };
  discovery?: {
    completedSections: string[];
  };
}

interface ProjectSummary {
  moduleCount: number;
  readyModuleCount: number;
  executionCount: number;
  validationStatus: string;
  readiness: string;
}

interface ModuleSummary {
  moduleId: string;
  name: string;
  status: string;
  readiness: string;
  blockerCount: number;
  warningCount: number;
}

interface ExecutionRecord {
  id: string;
  status: string;
  mode: string;
  startedAt: string;
  moduleKey: string;
}

interface DiscoveryPayload {
  completedSections: string[];
}

const discoverySections = [
  "businessContext",
  "platformContext",
  "crmArchitecture",
  "salesRequirements",
  "marketingRequirements",
  "serviceRequirements",
  "integrationsAndData",
  "governanceAndOps",
  "risksAndAssumptions"
];

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/-/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function statusClass(status: string) {
  switch (status) {
    case "ready":
    case "ready-for-execution":
      return "status-ready";
    case "completed":
    case "succeeded":
      return "status-complete";
    case "failed":
    case "blocked":
      return "status-blocked";
    default:
      return "status-in-progress";
  }
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const [
          projectResponse,
          summaryResponse,
          modulesResponse,
          executionsResponse,
          discoveryResponse
        ] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/summary`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/modules`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/executions`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery`)
        ]);

        if (
          !projectResponse.ok ||
          !summaryResponse.ok ||
          !modulesResponse.ok ||
          !executionsResponse.ok ||
          !discoveryResponse.ok
        ) {
          throw new Error("Failed to load project");
        }

        const projectBody = await projectResponse.json();
        const summaryBody = await summaryResponse.json();
        const modulesBody = await modulesResponse.json();
        const executionsBody = await executionsResponse.json();
        const discoveryBody = await discoveryResponse.json();

        setProject(projectBody.project);
        setSummary(summaryBody.summary);
        setModules(modulesBody.modules ?? []);
        setExecutions(executionsBody.executions ?? []);
        setDiscovery(discoveryBody.discovery ?? null);
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

    loadProject();
  }, [projectId]);

  const completedDiscoverySections =
    discovery?.completedSections.length ??
    project?.discovery?.completedSections.length ??
    0;

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
        ) : error || !project || !summary ? (
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
                    {project.status.replace(/-/g, " ")}
                  </span>
                </div>
                <p className="mt-3 text-text-secondary">
                  {project.clientContext.clientName} ·{" "}
                  {project.clientContext.primaryRegion}
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/projects/${project.id}/discovery`}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  Open Discovery
                </Link>
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Discovery",
                  `${completedDiscoverySections}/9 sections`,
                  "text-white"
                ],
                [
                  "Modules Ready",
                  `${summary.readyModuleCount}/${summary.moduleCount}`,
                  "text-status-success"
                ],
                ["Executions", `${summary.executionCount}`, "text-status-info"],
                [
                  "Readiness",
                  formatLabel(summary.readiness),
                  "text-status-warning"
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

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <h2 className="text-lg font-semibold text-white">
                    Project Context
                  </h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[
                      ["Client", project.clientContext.clientName],
                      ["Portal", project.hubspotScope.portal.displayName],
                      ["Portal ID", project.hubspotScope.portal.portalId],
                      ["Environment", project.hubspotScope.environment],
                      ["Owner", project.owner.name],
                      ["Owner Email", project.owner.email],
                      [
                        "Implementation Type",
                        formatLabel(project.clientContext.implementationType)
                      ],
                      ["Last Updated", formatDate(project.updatedAt)]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <p className="mt-2 text-sm text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                      Hubs In Scope
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.hubspotScope.hubsInScope.map((hub) => (
                        <span
                          key={hub}
                          className="rounded bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-white"
                        >
                          {hub}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      Module Readiness
                    </h2>
                    <span className="text-sm text-text-secondary">
                      {summary.validationStatus}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {modules.map((module) => (
                      <div
                        key={module.moduleId}
                        className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0b1126] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">
                              {module.name}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {module.moduleId}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                                module.readiness
                              )}`}
                            >
                              {module.readiness}
                            </span>
                            <p className="mt-2 text-xs text-text-muted">
                              {module.blockerCount} blockers ·{" "}
                              {module.warningCount} warnings
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      Discovery Progress
                    </h2>
                    <Link
                      href={`/projects/${project.id}/discovery`}
                      className="text-sm font-medium text-white"
                    >
                      Continue
                    </Link>
                  </div>

                  <div className="mt-5 space-y-2">
                    {discoverySections.map((section) => {
                      const complete =
                        discovery?.completedSections.includes(section) ??
                        project.discovery?.completedSections.includes(
                          section
                        ) ??
                        false;

                      return (
                        <div
                          key={section}
                          className="flex items-center justify-between rounded-xl bg-[#0b1126] px-4 py-3"
                        >
                          <span className="text-sm text-white">
                            {formatLabel(section)}
                          </span>
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              complete ? "bg-status-success" : "bg-text-muted"
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <h2 className="text-lg font-semibold text-white">
                    Recent Runs
                  </h2>
                  <div className="mt-5 space-y-3">
                    {executions.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        No executions recorded yet.
                      </p>
                    ) : (
                      executions.slice(0, 5).map((execution) => (
                        <div
                          key={execution.id}
                          className="rounded-xl bg-[#0b1126] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-medium text-white">
                              {execution.moduleKey}
                            </p>
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                                execution.status
                              )}`}
                            >
                              {execution.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-text-muted">
                            {execution.mode} · {formatDate(execution.startedAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
