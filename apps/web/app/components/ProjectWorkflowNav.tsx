"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  buildProjectWorkspaceClusters,
  resolveProjectWorkspaceMode
} from "./projectWorkspaceConfig";

function navClass(isActive: boolean) {
  return `rounded-2xl border px-4 py-3 text-sm font-medium transition ${
    isActive
      ? "border-[rgba(73,205,225,0.28)] bg-[rgba(73,205,225,0.12)] text-[#7be2ef]"
      : "border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-white hover:border-[rgba(255,255,255,0.14)]"
  }`;
}

export default function ProjectWorkflowNav({
  projectId,
  showDiscovery = true,
  engagementType
}: {
  projectId: string;
  showDiscovery?: boolean;
  engagementType?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resolvedProject, setResolvedProject] = useState<{
    engagementType: string | null;
    includesPortalAudit: boolean;
    portalId: string | null;
  }>({
    engagementType: engagementType ?? null,
    includesPortalAudit: false,
    portalId: null
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProjectNavigationState() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );
        const body = await response.json().catch(() => null);

        if (!response.ok || cancelled) {
          return;
        }

        setResolvedProject({
          engagementType:
            body?.project?.engagementType ?? engagementType ?? null,
          includesPortalAudit: body?.project?.includesPortalAudit === true,
          portalId:
            typeof body?.project?.portalId === "string"
              ? body.project.portalId
              : null
        });
      } catch {
        // Keep the existing navigation stable if this lightweight fetch fails.
      }
    }

    void loadProjectNavigationState();

    return () => {
      cancelled = true;
    };
  }, [engagementType, projectId]);

  const hasPortalAudit =
    resolvedProject.includesPortalAudit === true || resolvedProject.portalId !== null;
  const workspaceMode = resolveProjectWorkspaceMode({
    engagementType: resolvedProject.engagementType,
    hasPortal: hasPortalAudit
  });
  const clusters = buildProjectWorkspaceClusters({
    projectId,
    mode: workspaceMode.key,
    showDiscovery,
    hasPortalAudit
  });

  function isLinkActive(href: string) {
    const [targetPath, targetQuery] = href.split("?");

    if (pathname !== targetPath) {
      return false;
    }

    if (!targetQuery) {
      return true;
    }

    const targetParams = new URLSearchParams(targetQuery);
    return Array.from(targetParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value
    );
  }

  return (
    <nav className="mb-6 rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
            Workflow
          </p>
          <p className="mt-3 text-xl font-semibold text-white">
            {workspaceMode.label}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            {workspaceMode.summary}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}`}
          className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.18)] transition-colors"
        >
          ← Project Overview
        </Link>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        {clusters.map((cluster) => (
          <div
            key={cluster.label}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              {cluster.label}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {cluster.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navClass(isLinkActive(link.href))}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
