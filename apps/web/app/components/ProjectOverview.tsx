"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  ownerEmail: string;
  engagementType: string;
  selectedHubs: string[];
  updatedAt: string;
  client: {
    name: string;
    industry?: string | null;
    region?: string | null;
    website?: string | null;
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

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
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

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const [projectResponse, sessionsResponse, blueprintResponse] =
          await Promise.all([
            fetch(`/api/projects/${encodeURIComponent(projectId)}`),
            fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
            fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`)
          ]);

        if (!projectResponse.ok || !sessionsResponse.ok) {
          throw new Error("Failed to load project");
        }

        const projectBody = await projectResponse.json();
        const sessionsBody = await sessionsResponse.json();

        setProject(projectBody.project);
        setSessions(sessionsBody.sessionDetails ?? []);

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

    loadProject();
  }, [projectId]);

  const completedSessions = sessions.filter(
    (session) => session.status === "complete"
  ).length;
  const session1Complete =
    sessions.find((session) => session.session === 1)?.status === "complete";
  const session3Complete =
    sessions.find((session) => session.session === 3)?.status === "complete";
  const canGenerateBlueprint = session1Complete && session3Complete;
  const totalHumanHours =
    blueprint?.tasks
      .filter((task) => task.type === "Human")
      .reduce((total, task) => total + task.effortHours, 0) ?? 0;

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

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/projects/${project.id}/discovery`}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  Open Discovery
                </Link>
                <Link
                  href={
                    blueprint
                      ? `/blueprint/${project.id}`
                      : canGenerateBlueprint
                        ? `/blueprint/${project.id}?generate=1`
                        : `/blueprint/${project.id}`
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-medium text-white ${
                    canGenerateBlueprint
                      ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]"
                      : "border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted"
                  }`}
                >
                  {blueprint ? "Open Blueprint" : "Generate Blueprint"}
                </Link>
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Discovery",
                  `${completedSessions}/4 sessions`,
                  "text-white"
                ],
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
                  {[
                    ["Client", project.client.name],
                    ["Portal", project.portal?.displayName ?? "Pending"],
                    ["Portal ID", project.portal?.portalId ?? "Pending"],
                    ["Owner", project.owner],
                    ["Owner Email", project.ownerEmail],
                    ["Engagement Type", formatLabel(project.engagementType)],
                    ["Industry", project.client.industry ?? "Not set"],
                    ["Blueprint Generated", blueprint ? "Yes" : "No"]
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
                    {project.selectedHubs.map((hub) => (
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
                            /5 fields completed
                          </p>
                        </div>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                            session.status
                          )}`}
                        >
                          {formatLabel(session.status)}
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
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
