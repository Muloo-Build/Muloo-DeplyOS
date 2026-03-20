"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: string;
  hubsInScope: string[];
  updatedAt: string;
}

interface ProjectStats {
  total: number;
  inExecution: number;
  awaitingApproval: number;
  completed: number;
}

function calculateStats(items: Project[]): ProjectStats {
  return items.reduce(
    (acc, project) => {
      acc.total += 1;
      if (project.status === "in-flight") acc.inExecution += 1;
      if (project.status === "ready-for-execution") {
        acc.awaitingApproval += 1;
      }
      if (project.status === "completed") acc.completed += 1;
      return acc;
    },
    {
      total: 0,
      inExecution: 0,
      awaitingApproval: 0,
      completed: 0
    }
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "status-complete";
    case "ready-for-execution":
      return "status-ready";
    case "in-flight":
    case "scoping":
    case "designed":
      return "status-in-progress";
    default:
      return "status-draft";
  }
}

function getHubColor(hub: string) {
  switch (hub) {
    case "sales":
      return "hub-sales";
    case "marketing":
      return "hub-marketing";
    case "service":
      return "hub-service";
    case "cms":
      return "hub-cms";
    case "data":
      return "hub-ops";
    case "commerce":
      return "hub-sales";
    default:
      return "hub-ops";
  }
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    inExecution: 0,
    awaitingApproval: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }

        const payload = await response.json();
        const items: Project[] = Array.isArray(payload)
          ? payload
          : (payload.projects ?? []);

        setProjects(items);
        setStats(calculateStats(items));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  async function deleteProject(project: Project) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This will remove the project, its discovery sessions, and its blueprint.`
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setStatusError(null);
    setDeletingProjectId(project.id);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete project");
      }

      setProjects((currentProjects) => {
        const nextProjects = currentProjects.filter(
          (currentProject) => currentProject.id !== project.id
        );
        setStats(calculateStats(nextProjects));
        return nextProjects;
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete project"
      );
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function updateProjectStatus(
    project: Project,
    status: "archived" | "active"
  ) {
    setDeleteError(null);
    setStatusError(null);
    setUpdatingProjectId(project.id);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to mark project as ${status}`);
      }

      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === project.id
            ? { ...currentProject, status }
            : currentProject
        )
      );
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Failed to update project"
      );
    } finally {
      setUpdatingProjectId(null);
    }
  }

  const activeProjects = projects.filter((project) => project.status !== "archived");
  const archivedProjects = projects.filter(
    (project) => project.status === "archived"
  );

  function renderProjectTable(
    items: Project[],
    options?: { archived?: boolean }
  ) {
    const archived = options?.archived ?? false;

    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card">
        <div className="grid grid-cols-[2fr_1fr_1fr_220px] gap-4 border-b border-[rgba(255,255,255,0.07)] px-6 py-4 text-xs uppercase tracking-[0.2em] text-text-muted">
          <span>Project</span>
          <span>Hubs</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>

        {items.map((project) => (
          <div
            key={project.id}
            className="grid grid-cols-[2fr_1fr_1fr_220px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-6 py-5 transition-colors hover:bg-background-elevated last:border-b-0"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-lg font-semibold text-white transition-opacity hover:opacity-80"
                >
                  {project.name}
                </Link>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status.replace(/-/g, " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                {project.clientName}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {project.hubsInScope.map((hub) => (
                <span
                  key={hub}
                  className={`rounded px-2 py-1 text-xs font-medium ${getHubColor(
                    hub
                  )}`}
                >
                  {hub}
                </span>
              ))}
            </div>

            <div className="text-sm text-text-secondary">
              {formatRelativeDate(project.updatedAt)}
            </div>

            <div className="flex items-start justify-end gap-3 text-sm font-medium">
              <Link href={`/projects/${project.id}`} className="text-white">
                View
              </Link>
              {archived ? (
                <button
                  type="button"
                  onClick={() => void updateProjectStatus(project, "active")}
                  disabled={updatingProjectId === project.id}
                  className="text-[#8bd5ff] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingProjectId === project.id ? "Restoring..." : "Restore"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void updateProjectStatus(project, "archived")}
                  disabled={updatingProjectId === project.id}
                  className="text-[#ffd38b] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingProjectId === project.id ? "Archiving..." : "Archive"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void deleteProject(project)}
                disabled={deletingProjectId === project.id}
                className="text-[#ff8b8b] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingProjectId === project.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Delivery orchestration
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Projects
            </h1>
            <p className="mt-2 text-text-secondary">
              Discovery-led HubSpot implementation planning for the Muloo team.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            New Project
          </Link>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Projects", `${stats.total}`, "text-white"],
            ["In Execution", `${stats.inExecution}`, "text-status-info"],
            [
              "Awaiting Approval",
              `${stats.awaitingApproval}`,
              "text-status-warning"
            ],
            ["Completed", `${stats.completed}`, "text-status-success"]
          ].map(([label, value, valueClass]) => (
            <div
              key={label}
              className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
            >
              <p className="text-sm text-text-muted">{label}</p>
              <p className={`mt-3 text-3xl font-semibold ${valueClass}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {deleteError ? (
          <div className="mb-6 rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card px-5 py-4 text-sm text-white">
            {deleteError}
          </div>
        ) : null}

        {statusError ? (
          <div className="mb-6 rounded-2xl border border-[rgba(240,160,80,0.35)] bg-background-card px-5 py-4 text-sm text-white">
            {statusError}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-24 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : activeProjects.length === 0 && archivedProjects.length === 0 ? (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-12 text-center">
            <h2 className="text-xl font-semibold text-white">
              No projects yet
            </h2>
            <p className="mt-3 text-text-secondary">
              Start a project, capture discovery, then shape the delivery plan.
            </p>
            <Link
              href="/projects/new"
              className="mt-6 inline-flex rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Active Projects</h2>
                <p className="text-sm text-text-secondary">
                  {activeProjects.length} on the main board
                </p>
              </div>
              {activeProjects.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-sm text-text-secondary">
                  No active projects right now.
                </div>
              ) : (
                renderProjectTable(activeProjects)
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Archived Projects</h2>
                <p className="text-sm text-text-secondary">
                  {archivedProjects.length} tucked away
                </p>
              </div>
              {archivedProjects.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-sm text-text-secondary">
                  No archived projects yet.
                </div>
              ) : (
                renderProjectTable(archivedProjects, { archived: true })
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
