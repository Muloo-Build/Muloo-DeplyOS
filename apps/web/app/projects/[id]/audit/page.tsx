"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SkeletonBlock } from "../../../components/LoadingSkeleton";
import PortalAuditWorkspace from "../../../components/PortalAuditWorkspace";
import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";
import { Btn } from "../../../components/ui/Btn";
import { Empty } from "../../../components/ui/Empty";
import { PageHead } from "../../../components/ui/PageHead";

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
    <ProjectWorkspaceView projectId={params.id} activeTab="audit">
      <div className="space-y-6">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${params.id}`}
              className="hover:text-text-1 transition-colors"
            >
              ← Project workspace
            </Link>
          }
          title="Portal audit"
          lede="Compare planned configuration against the live HubSpot portal. Surface drift in properties, pipelines, workflows, and reports."
        />
        {loading ? (
          <SkeletonBlock height="h-64" />
        ) : error ? (
          <Empty title="Audit error" sub={error} />
        ) : project?.portalId ? (
          <PortalAuditWorkspace projectId={params.id} />
        ) : project?.includesPortalAudit ? (
          <Empty
            title="Connect a HubSpot portal"
            sub="The audit needs a linked HubSpot portal before it can compare configuration."
            action={
              <Link href={`/projects/${params.id}`}>
                <Btn variant="ghost" size="sm">
                  Back to project overview
                </Btn>
              </Link>
            }
          />
        ) : (
          <Empty
            title="Redirecting…"
            sub="Audit is not enabled for this project."
          />
        )}
      </div>
    </ProjectWorkspaceView>
  );
}
