"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";
import {
  type PortalExperience,
  getPortalProjectPath
} from "./portalExperience";

interface ClientProject {
  role: string;
  project: {
    id: string;
    name: string;
    status: string;
    scopeType?: string | null;
    engagementType: string;
    selectedHubs: string[];
    updatedAt: string;
    client: {
      name: string;
      website?: string | null;
    };
  };
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    in_progress: "In Progress",
    complete: "Complete",
    on_hold: "On Hold",
    cancelled: "Cancelled"
  };
  return map[status] ?? status;
}

function statusColor(status: string) {
  if (status === "active" || status === "in_progress") return "text-[#51d0b0] bg-[rgba(81,208,176,0.12)] border-[rgba(81,208,176,0.2)]";
  if (status === "complete") return "text-[#7be2ef] bg-[rgba(123,226,239,0.1)] border-[rgba(123,226,239,0.18)]";
  if (status === "on_hold") return "text-[#f0c060] bg-[rgba(240,192,96,0.1)] border-[rgba(240,192,96,0.18)]";
  if (status === "cancelled") return "text-text-muted bg-white/5 border-white/10";
  return "text-text-secondary bg-white/5 border-white/10";
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-ZA", { dateStyle: "medium" });
}

export default function ClientProjectsDashboard({
  portalExperience = "client"
}: {
  portalExperience?: PortalExperience;
}) {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/client/projects", {
          credentials: "include"
        });
        if (!response.ok) throw new Error("Failed to load projects");
        const body = await response.json();
        setProjects(body.projects ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
  }, []);

  const activeProjects = projects.filter(({ project }) =>
    ["active", "in_progress", "draft"].includes(project.status)
  );
  const otherProjects = projects.filter(({ project }) =>
    !["active", "in_progress", "draft"].includes(project.status)
  );

  return (
    <ClientShell portalExperience={portalExperience}>
      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-text-secondary">
          Loading your projects...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-6 text-white">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-10 text-center">
          <p className="text-text-secondary">No projects assigned yet.</p>
          <p className="mt-2 text-sm text-text-muted">Your projects will appear here once Muloo sets them up for you.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeProjects.length > 0 ? (
            <div>
              <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                Active projects
              </h2>
              <div className="grid gap-3">
                {activeProjects.map(({ project, role }) => (
                  <Link
                    key={project.id}
                    href={getPortalProjectPath(portalExperience, project.id)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-5 transition hover:border-[rgba(255,255,255,0.13)] hover:bg-[rgba(255,255,255,0.02)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {project.name}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {project.client.name}
                        {project.selectedHubs.length > 0
                          ? ` · ${project.selectedHubs.join(", ")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                      <span className="text-xs text-text-muted hidden sm:block">
                        Updated {formatDate(project.updatedAt)}
                      </span>
                      <span className="text-text-muted">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {otherProjects.length > 0 ? (
            <div>
              <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                Other projects
              </h2>
              <div className="grid gap-3">
                {otherProjects.map(({ project, role }) => (
                  <Link
                    key={project.id}
                    href={getPortalProjectPath(portalExperience, project.id)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-5 opacity-70 transition hover:border-[rgba(255,255,255,0.1)] hover:opacity-100"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {project.name}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {project.client.name}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                      <span className="text-text-muted">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ClientShell>
  );
}
