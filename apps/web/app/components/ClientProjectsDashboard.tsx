"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";

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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default function ClientProjectsDashboard() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/client/projects", {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Failed to load client projects");
        }

        const body = await response.json();
        setProjects(body.projects ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load client projects"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProjects();
  }, []);

  return (
    <ClientShell title="Projects">
      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading projects...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-6 text-white">
          {error}
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(({ project, role }) => (
            <Link
              key={project.id}
              href={`/client/projects/${project.id}`}
              className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 transition hover:border-[rgba(255,255,255,0.14)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    {role}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {project.name}
                  </h3>
                  <p className="mt-2 text-text-secondary">
                    {project.client.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-text-muted">
                    <span>
                      {project.scopeType === "standalone_quote"
                        ? "Standalone scoped job"
                        : "Discovery-led project"}
                    </span>
                    <span>·</span>
                    <span>{project.selectedHubs.join(", ")}</span>
                  </div>
                </div>
                <div className="text-right text-sm text-text-secondary">
                  <p>Updated</p>
                  <p className="mt-2 text-white">
                    {formatDate(project.updatedAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </ClientShell>
  );
}
