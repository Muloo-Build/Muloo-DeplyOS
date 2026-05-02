"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, MoreHorizontal } from "lucide-react";

import AppShell from "./AppShell";
import EmptyState from "./EmptyState";
import { SkeletonRows } from "./LoadingSkeleton";
import { useToast } from "./Toast";
import { isLiveProjectStatus } from "./projectStatus";

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: string;
  quoteApprovalStatus?: string;
  hubsInScope: string[];
  updatedAt: string;
  defaultWorkspacePath?: string;
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
      if (project.quoteApprovalStatus === "shared") {
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

function getFilterMeta(status: string | null) {
  switch (status) {
    case "live":
      return {
        title: "Live projects",
        body: "All non-archived projects in the workspace."
      };
    case "in_delivery":
      return {
        title: "In delivery",
        body: "Projects currently in active execution."
      };
    case "awaiting_approval":
      return {
        title: "Awaiting approval",
        body: "Projects with a shared quote waiting for client approval."
      };
    case "blocked_external":
      return {
        title: "Blocked external",
        body: "Projects waiting on client or partner input."
      };
    case "awaiting_client":
      return {
        title: "Awaiting response",
        body: "Projects waiting on external input or a shared quote response."
      };
    default:
      return null;
  }
}

export default function ProjectsDashboard({
  initialStatus = null
}: {
  initialStatus?: string | null;
}) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    inExecution: 0,
    awaitingApproval: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(
    null
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? initialStatus;
  const filterMeta = getFilterMeta(statusFilter);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpenMenuId(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!pendingDelete) {
      // Restore focus to whatever opened the modal, if we still have a handle.
      const previous = lastFocusedRef.current;
      lastFocusedRef.current = null;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
      return;
    }
    // Capture the trigger element so we can restore focus on close.
    if (
      document.activeElement instanceof HTMLElement &&
      lastFocusedRef.current === null
    ) {
      lastFocusedRef.current = document.activeElement;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingDelete(null);
        setDeleteConfirmText("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDelete]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const query = statusFilter
          ? `?status=${encodeURIComponent(statusFilter)}`
          : "";
        const response = await fetch(`/api/projects${query}`);
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
        toast.error(
          error instanceof Error ? error.message : "Failed to load projects"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [statusFilter]);

  async function deleteProject(project: Project) {
    setDeletingProjectId(project.id);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "DELETE"
        }
      );

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
      toast.success(`"${project.name}" deleted.`);
      setPendingDelete(null);
      setDeleteConfirmText("");
    } catch (error) {
      toast.error(
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
      toast.success(
        status === "archived"
          ? `"${project.name}" archived.`
          : `"${project.name}" restored.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project"
      );
    } finally {
      setUpdatingProjectId(null);
    }
  }

  const activeProjects = projects.filter((project) =>
    isLiveProjectStatus(project.status)
  );
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

            <div className="relative flex items-start justify-end text-sm font-medium">
              <button
                type="button"
                onClick={() =>
                  setOpenMenuId((current) =>
                    current === project.id ? null : project.id
                  )
                }
                aria-haspopup="menu"
                aria-expanded={openMenuId === project.id}
                aria-label={`Actions for ${project.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-background-elevated text-text-secondary transition hover:border-white/15 hover:text-white"
              >
                <MoreHorizontal size={16} />
              </button>
              {openMenuId === project.id ? (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label={`Actions for ${project.name}`}
                  className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111933] py-1 shadow-2xl"
                >
                  <Link
                    href={`/projects/${project.id}/edit`}
                    role="menuitem"
                    onClick={() => setOpenMenuId(null)}
                    className="block px-3 py-2 text-sm text-text-secondary transition hover:bg-background-elevated hover:text-white"
                  >
                    Edit
                  </Link>
                  {archived ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        void updateProjectStatus(project, "active");
                      }}
                      disabled={updatingProjectId === project.id}
                      className="block w-full px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-background-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingProjectId === project.id
                        ? "Restoring…"
                        : "Restore from archive"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        void updateProjectStatus(project, "archived");
                      }}
                      disabled={updatingProjectId === project.id}
                      className="block w-full px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-background-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingProjectId === project.id
                        ? "Archiving…"
                        : "Archive"}
                    </button>
                  )}
                  <div className="my-1 border-t border-[rgba(255,255,255,0.06)]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      setPendingDelete(project);
                      setDeleteConfirmText("");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    Delete project…
                  </button>
                </div>
              ) : null}
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
              Delivery
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Projects
            </h1>
            <p className="mt-2 text-text-secondary">
              HubSpot implementation, optimisation, and integration projects across all active clients.
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

        {loading ? (
          <SkeletonRows
            count={3}
            height="h-24"
            rounded="rounded-2xl"
            gap="gap-3"
          />
        ) : activeProjects.length === 0 && archivedProjects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={32} />}
            title="No projects yet"
            description="Start a project, capture discovery, then shape the delivery plan."
            primaryCta={{ label: "Create your first project →", href: "/projects/new" }}
          />
        ) : (
          <div className="space-y-8">
            {filterMeta ? (
              <div className="rounded-2xl border border-[rgba(123,226,239,0.22)] bg-[rgba(123,226,239,0.08)] px-6 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Filter
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {filterMeta.title}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {filterMeta.body}
                    </p>
                  </div>
                  <Link
                    href="/projects"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white"
                  >
                    Show all projects
                  </Link>
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Active Projects
                </h2>
                <p className="text-sm text-text-secondary">
                  {activeProjects.length} on the main board
                </p>
              </div>
              {activeProjects.length === 0 ? (
                <EmptyState
                  title="No active projects right now"
                  description="Projects you're actively working on will appear here."
                  primaryCta={{ label: "New project →", href: "/projects/new" }}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-10 text-center flex flex-col items-center"
                />
              ) : (
                renderProjectTable(activeProjects)
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Archived Projects
                </h2>
                <p className="text-sm text-text-secondary">
                  {archivedProjects.length} tucked away
                </p>
              </div>
              {archivedProjects.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-8 text-sm text-text-secondary">
                  No archived projects yet.
                </div>
              ) : (
                renderProjectTable(archivedProjects, { archived: true })
              )}
            </div>
          </div>
        )}
      </div>

      {pendingDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,0.72)] px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingDelete(null);
              setDeleteConfirmText("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-[#111933] p-6 shadow-2xl">
            <h3
              id="delete-project-title"
              className="text-lg font-semibold text-white"
            >
              Delete &ldquo;{pendingDelete.name}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This permanently removes the project, its discovery sessions,
              workbooks, blueprint and any linked records. This cannot be
              undone.
            </p>
            <p className="mt-4 text-sm text-text-secondary">
              Type{" "}
              <code className="rounded bg-background-elevated px-1.5 py-0.5 text-xs text-white">
                {pendingDelete.name}
              </code>{" "}
              to confirm.
            </p>
            <input
              type="text"
              autoFocus
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Project name"
              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-rose-300/40 focus:outline-none focus:ring-1 focus:ring-rose-300/20"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteConfirmText("");
                }}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-white/15 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteConfirmText !== pendingDelete.name ||
                  deletingProjectId === pendingDelete.id
                }
                onClick={() => void deleteProject(pendingDelete)}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingProjectId === pendingDelete.id
                  ? "Deleting…"
                  : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
