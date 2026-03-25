export type ProjectWorkspaceModeKey =
  | "implementation"
  | "optimisation"
  | "scoped_change"
  | "onsite_workshop";

export type ProjectWorkspaceCluster = {
  label: string;
  links: Array<{
    href: string;
    label: string;
    requiresAudit?: boolean;
  }>;
};

function normalizeEngagementType(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function resolveProjectWorkspaceMode(input: {
  engagementType?: string | null;
  hasPortal?: boolean;
}) {
  const engagementType = normalizeEngagementType(input.engagementType);

  if (engagementType === "AUDIT" || engagementType === "OPTIMISATION") {
    return {
      key: "optimisation" as const,
      label: "Audit & Optimisation",
      summary:
        "Start with portal health, prior context, and meeting prep before deciding on scope."
    };
  }

  if (engagementType === "GUIDED_DEPLOYMENT") {
    return {
      key: "onsite_workshop" as const,
      label: "Workshop / Sprint",
      summary:
        "Use this workspace to prepare onsite sessions, capture context quickly, and shape what gets scoped next."
    };
  }

  if (engagementType === "IMPLEMENTATION" && input.hasPortal) {
    return {
      key: "scoped_change" as const,
      label: "Follow-on Work",
      summary:
        "This looks like additional work for an existing client, so keep context, audit, and scoping close together."
    };
  }

  return {
    key: "implementation" as const,
    label: "Implementation",
    summary:
      "Use the full discovery-to-delivery flow when you are shaping a fresh implementation or major rollout."
  };
}

export function buildProjectWorkspaceClusters(input: {
  projectId: string;
  mode: ProjectWorkspaceModeKey;
  showDiscovery?: boolean;
  hasPortalAudit?: boolean;
}) {
  const showDiscovery = input.showDiscovery !== false;
  const clusters: ProjectWorkspaceCluster[] = [
    {
      label: "Context",
      links: [
        {
          href: `/projects/${input.projectId}?view=summary`,
          label: "Project Summary"
        },
        {
          href: `/projects/${input.projectId}/prepare`,
          label: "Prepare"
        },
        {
          href: `/projects/${input.projectId}/inputs`,
          label: "Inputs"
        }
      ]
    }
  ];

  if (input.mode === "optimisation" || input.mode === "scoped_change") {
    clusters.push({
      label: "Diagnose",
      links: [
        {
          href: `/projects/${input.projectId}/audit`,
          label: "Portal Audit",
          requiresAudit: true
        },
        ...(showDiscovery
          ? [
              {
                href: `/projects/${input.projectId}/discovery`,
                label: "Discovery Inputs"
              },
              {
                href: `/projects/${input.projectId}/proposal`,
                label: "Working Doc"
              }
            ]
          : [])
      ]
    });
  } else {
    clusters.push({
      label: "Discover",
      links: [
        ...(showDiscovery
          ? [
              {
                href: `/projects/${input.projectId}/discovery`,
                label: "Discovery Inputs"
              },
              {
                href: `/projects/${input.projectId}/proposal`,
                label: "Discovery Doc"
              }
            ]
          : []),
        ...(input.hasPortalAudit
          ? [
              {
                href: `/projects/${input.projectId}/audit`,
                label: "Audit"
              }
            ]
          : [])
      ]
    });
  }

  clusters.push(
    {
      label: "Plan",
      links: [
        {
          href: `/blueprint/${input.projectId}`,
          label: "Blueprint"
        },
        {
          href: `/projects/${input.projectId}/quote`,
          label: "Scope & Approval"
        }
      ]
    },
    {
      label: "Deliver",
      links: [
        {
          href: `/projects/${input.projectId}/changes`,
          label: "Change Mgmt"
        },
        {
          href: `/projects/${input.projectId}/delivery`,
          label: "Delivery Board"
        }
      ]
    }
  );

  return clusters
    .map((cluster) => ({
      ...cluster,
      links: cluster.links.filter(
        (link) => !link.requiresAudit || input.hasPortalAudit
      )
    }))
    .filter((cluster) => cluster.links.length > 0);
}
