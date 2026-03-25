"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../../../components/AppShell";
import PortalAuditWorkspace from "../../../components/PortalAuditWorkspace";

interface ProjectAuditState {
  portalId: string | null;
  includesPortalAudit: boolean;
}

export default function ProjectAuditPage({
  params
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectAuditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(params.id)}`
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to load project");
        }

        if (!cancelled) {
          setProject({
            portalId:
              typeof body?.project?.portalId === "string"
                ? body.project.portalId
                : null,
            includesPortalAudit: body?.project?.includesPortalAudit === true
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load project"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (
      loading ||
      error ||
      !project ||
      project.portalId ||
      project.includesPortalAudit
    ) {
      return;
    }

    router.replace(`/projects/${params.id}`);
  }, [error, loading, params.id, project, router]);

  return (
    <AppShell>
      <div className="p-8">
        {loading ? (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-text-secondary">
            Loading audit workspace...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error}
          </div>
        ) : project?.portalId ? (
          <PortalAuditWorkspace projectId={params.id} />
        ) : project?.includesPortalAudit ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="max-w-xl rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-8 py-10 text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Audit Setup
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                Connect a HubSpot portal to start auditing this project.
              </h1>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8 text-text-secondary">
            Redirecting...
          </div>
        )}
      </div>
    </AppShell>
  );
}
