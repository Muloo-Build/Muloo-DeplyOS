"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProjectOverview from "./ProjectOverview";

function shouldRedirectToPrepare(engagementType: string | null | undefined) {
  return (
    engagementType === "AUDIT" ||
    engagementType === "OPTIMISATION" ||
    engagementType === "GUIDED_DEPLOYMENT"
  );
}

export default function ProjectWorkspaceLanding({
  projectId,
  forceSummary = false
}: {
  projectId: string;
  forceSummary?: boolean;
}) {
  const router = useRouter();
  const [readyForSummary, setReadyForSummary] = useState(forceSummary);

  useEffect(() => {
    if (forceSummary) {
      return;
    }

    let cancelled = false;

    async function resolveLanding() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          if (!cancelled) {
            setReadyForSummary(true);
          }
          return;
        }

        if (
          !cancelled &&
          shouldRedirectToPrepare(body?.project?.engagementType ?? null)
        ) {
          router.replace(`/projects/${projectId}/prepare`);
          return;
        }

        if (!cancelled) {
          setReadyForSummary(true);
        }
      } catch {
        if (!cancelled) {
          setReadyForSummary(true);
        }
      }
    }

    void resolveLanding();

    return () => {
      cancelled = true;
    };
  }, [forceSummary, projectId, router]);

  if (!readyForSummary) {
    return (
      <div className="p-8">
        <div className="grid gap-4">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
            />
          ))}
        </div>
      </div>
    );
  }

  return <ProjectOverview projectId={projectId} />;
}
