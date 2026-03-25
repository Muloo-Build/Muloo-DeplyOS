"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [resolvedEngagementType, setResolvedEngagementType] = useState<
    string | null
  >(engagementType ?? null);

  useEffect(() => {
    if (engagementType) {
      setResolvedEngagementType(engagementType);
      return;
    }

    let cancelled = false;

    async function loadProjectEngagementType() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );
        const body = await response.json().catch(() => null);

        if (!response.ok || cancelled) {
          return;
        }

        setResolvedEngagementType(body?.project?.engagementType ?? null);
      } catch {
        // Keep the existing navigation stable if this lightweight fetch fails.
      }
    }

    void loadProjectEngagementType();

    return () => {
      cancelled = true;
    };
  }, [engagementType, projectId]);

  const links = [
    {
      href: `/projects/${projectId}`,
      label: "Project Summary"
    },
    {
      href: `/projects/${projectId}/inputs`,
      label: "Project Inputs"
    },
    ...(showDiscovery
      ? [
          {
            href: `/projects/${projectId}/discovery`,
            label: "Discovery Inputs"
          },
          {
            href: `/projects/${projectId}/proposal`,
            label: "Discovery Doc"
          }
        ]
      : []),
    {
      href: `/blueprint/${projectId}`,
      label: "Blueprint"
    },
    {
      href: `/projects/${projectId}/quote`,
      label: "Quote & Approval"
    },
    {
      href: `/projects/${projectId}/changes`,
      label: "Change Mgmt"
    },
    {
      href: `/projects/${projectId}/delivery`,
      label: "Delivery Board"
    },
    ...(resolvedEngagementType === "OPTIMISATION"
      ? [
          {
            href: `/projects/${projectId}/audit`,
            label: "Audit"
          }
        ]
      : [])
  ];

  return (
    <nav className="mb-6 rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
        Workflow
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={navClass(pathname === link.href)}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
