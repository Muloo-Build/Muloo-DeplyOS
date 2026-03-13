"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  engagementType: string;
  client: {
    name: string;
  };
  selectedHubs: string[];
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

const sessionDescriptions: Record<number, string> = {
  1: "Capture the business context, commercial drivers, success metrics, and timeline constraints.",
  2: "Audit the current systems, data landscape, and the way the team operates today.",
  3: "Define the target HubSpot design, future-state process, automation, integrations, and reporting.",
  4: "Lock delivery boundaries, client responsibilities, risks, and agreed next steps."
};

function statusLabel(status: SessionDetail["status"]) {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

function statusClass(status: SessionDetail["status"]) {
  switch (status) {
    case "complete":
      return "status-ready";
    case "in_progress":
      return "status-in-progress";
    default:
      return "status-draft";
  }
}

export default function DiscoveryWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [projectResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`)
        ]);

        if (!projectResponse.ok || !sessionsResponse.ok) {
          throw new Error("Failed to load discovery workspace");
        }

        const projectBody = await projectResponse.json();
        const sessionsBody = await sessionsResponse.json();

        setProject(projectBody.project);
        setSessions(sessionsBody.sessionDetails ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load discovery workspace"
        );
      } finally {
        setLoading(false);
      }
    }

    loadWorkspace();
  }, [projectId]);

  const session1Complete =
    sessions.find((session) => session.session === 1)?.status === "complete";
  const session3Complete =
    sessions.find((session) => session.session === 3)?.status === "complete";
  const canGenerateBlueprint = session1Complete && session3Complete;
  const completedSessions = sessions.filter(
    (session) => session.status === "complete"
  ).length;

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
                <Link
                  href={`/projects/${projectId}`}
                  className="text-sm text-text-muted"
                >
                  Back to overview
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  Discovery - {project.name}
                </h1>
                <p className="mt-2 text-text-secondary">
                  {project.client.name} - {project.selectedHubs.join(", ")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-5 py-4 text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Sessions complete
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {completedSessions}/4
                  </p>
                </div>

                <Link
                  href={`/blueprint/${projectId}?generate=1`}
                  aria-disabled={!canGenerateBlueprint}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${
                    canGenerateBlueprint
                      ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]"
                      : "cursor-not-allowed border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted pointer-events-none"
                  }`}
                >
                  Generate Blueprint
                </Link>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Phase 2 readiness
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Blueprint generation unlocks when Session 1 and Session 3
                    are complete
                  </h2>
                  <p className="mt-2 max-w-3xl text-text-secondary">
                    Session 1 validates the business case and success criteria.
                    Session 3 defines the future-state HubSpot design. Both are
                    required before DeplyOS can create a reliable delivery
                    blueprint.
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Required sessions
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white">Session 1</span>
                      <span className={statusClass(sessions[0]?.status ?? "draft")}>
                        {statusLabel(sessions[0]?.status ?? "draft")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white">Session 3</span>
                      <span className={statusClass(sessions[2]?.status ?? "draft")}>
                        {statusLabel(sessions[2]?.status ?? "draft")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {sessions.map((session) => {
                const completedFieldCount = Object.values(session.fields).filter(
                  (value) => value.trim().length > 0
                ).length;

                return (
                  <section
                    key={session.session}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Session {session.session}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          {session.title}
                        </h2>
                      </div>

                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                          session.status
                        )}`}
                      >
                        {statusLabel(session.status)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-text-secondary">
                      {sessionDescriptions[session.session]}
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Fields completed
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {completedFieldCount}/5
                        </p>
                      </div>

                      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Blueprint dependency
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {session.session === 1 || session.session === 3
                            ? "Required for generation"
                            : "Supports scoping detail"}
                        </p>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
